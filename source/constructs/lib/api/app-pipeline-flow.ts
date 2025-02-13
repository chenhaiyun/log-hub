/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { Construct } from "constructs";
import {
  Fn,
  Duration,
  aws_stepfunctions_tasks as tasks,
  aws_stepfunctions as sfn,
  aws_logs as logs,
  aws_lambda as lambda,
  aws_iam as iam,
  SymlinkFollowMode,
} from "aws-cdk-lib";
import { Table, ITable } from "aws-cdk-lib/aws-dynamodb";

import * as path from "path";

export interface PipelineFlowProps {
  /**
   * Step Functions State Machine ARN for CloudFormation deployment Flow
   *
   * @default - None.
   */
  readonly cfnFlowSMArn: string;

  /**
   * Pipeline Table Name
   *
   * @default - None.
   */
  readonly tableName: string;

  /**
   * Pipeline Table ARN
   *
   * @default - None.
   */
  readonly tableArn: string;
}

/**
 * Stack to provision a Step Functions State Machine to orchestrate pipeline flow
 * This flow will call CloudFormation Deployment Flow (Child Flow)
 */
export class AppPipelineFlowStack extends Construct {
  readonly stateMachineArn: string;

  constructor(scope: Construct, id: string, props: PipelineFlowProps) {
    super(scope, id);

    const solution_id = "SO8025";

    // Step Functions Tasks
    const table = Table.fromTableArn(this, "Table", props.tableArn);

    // Create a Lambda to handle the status update to backend table.
    const appPipeFlowFn = new lambda.Function(this, "AppPipeFlowFn", {
      code: lambda.AssetCode.fromAsset(
        path.join(__dirname, "../../lambda/api/app_pipeline_flow"),
        { followSymlinks: SymlinkFollowMode.ALWAYS }
      ),
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: "lambda_function.lambda_handler",
      timeout: Duration.seconds(60),
      memorySize: 128,
      environment: {
        SOLUTION_ID: solution_id,
        PIPELINE_TABLE: props.tableName,
        SOLUTION_VERSION: process.env.VERSION ? process.env.VERSION : "v1.0.0",
      },
      description: "Log Hub - Helper function to update pipeline status",
    });

    table.grantReadWriteData(appPipeFlowFn);
    const child = sfn.StateMachine.fromStateMachineArn(
      this,
      "ChildSM",
      props.cfnFlowSMArn
    );

    // Include the state machine in a Task state with callback pattern
    const cfnTask = new tasks.StepFunctionsStartExecution(
      this,
      "CloudFormation Flow",
      {
        stateMachine: child,
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        input: sfn.TaskInput.fromObject({
          token: sfn.JsonPath.taskToken,
          input: sfn.JsonPath.entirePayload,
        }),
        resultPath: "$.result",
      }
    );

    // State machine log group for error logs
    const logGroup = new logs.LogGroup(this, "ErrorLogGroup", {
      logGroupName: `/aws/vendedlogs/states/${Fn.select(
        6,
        Fn.split(":", props.cfnFlowSMArn)
      )}-SM-app-pipe-error`,
    });

    // Role for state machine
    const LogHubAppPipelineAPIPipelineFlowSMRole = new iam.Role(
      this,
      "SMRole",
      {
        assumedBy: new iam.ServicePrincipal("states.amazonaws.com"),
      }
    );
    // Least Privilage to enable logging for state machine
    LogHubAppPipelineAPIPipelineFlowSMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "logs:PutResourcePolicy",
          "logs:DescribeLogGroups",
          "logs:UpdateLogDelivery",
          "logs:AssociateKmsKey",
          "logs:GetLogGroupFields",
          "logs:PutRetentionPolicy",
          "logs:CreateLogGroup",
          "logs:PutDestination",
          "logs:DescribeResourcePolicies",
          "logs:GetLogDelivery",
          "logs:ListLogDeliveries",
        ],
        effect: iam.Effect.ALLOW,
        resources: [logGroup.logGroupArn],
      })
    );

    const appPipeFlowFnTask = new tasks.LambdaInvoke(this, "Update Status", {
      lambdaFunction: appPipeFlowFn,
      outputPath: "$.Payload",
      inputPath: "$",
    });

    const pipeSM = new sfn.StateMachine(this, "PipelineFlowSM", {
      definition: cfnTask.next(appPipeFlowFnTask),
      role: LogHubAppPipelineAPIPipelineFlowSMRole,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    this.stateMachineArn = pipeSM.stateMachineArn;
  }
}
