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
import { InstanceGroup } from "API";
import {
  ASG_LAUNCH_CONFIG_LINK,
  ASG_LAUNCH_TEMPLATE_LINK,
} from "assets/js/const";
import { appSyncRequestQuery } from "assets/js/request";
import Alert from "components/Alert";
import CodeCopy from "components/CodeCopy";
import ExtLink from "components/ExtLink";
import FormItem from "components/FormItem";
import HeaderPanel from "components/HeaderPanel";
import LoadingText from "components/LoadingText";
import { getAutoScalingGroupConf } from "graphql/queries";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

interface ASGGuideProps {
  instanceGroup: InstanceGroup;
}

const ASGGuide: React.FC<ASGGuideProps> = (props: ASGGuideProps) => {
  const { instanceGroup } = props;
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState("");
  const getASGConfig = async () => {
    setLoading(true);
    try {
      const res = await appSyncRequestQuery(getAutoScalingGroupConf, {
        groupId: instanceGroup.id,
      });
      setGuide(res.data.getAutoScalingGroupConf);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error(error);
    }
  };

  useEffect(() => {
    if (instanceGroup.id) {
      getASGConfig();
    }
  }, [instanceGroup.id]);

  return (
    <HeaderPanel title={t("resource:group.detail.asg.asgGuide")}>
      <>
        {guide ? (
          <>
            <Alert
              content={
                <div>
                  {t("resource:group.detail.asg.asgTips1")}
                  <ExtLink to={ASG_LAUNCH_TEMPLATE_LINK}>
                    {t("resource:group.detail.asg.asgTips2")}
                  </ExtLink>
                  {t("resource:group.detail.asg.asgTips3")}
                  <ExtLink to={ASG_LAUNCH_CONFIG_LINK}>
                    {t("resource:group.detail.asg.asgTips4")}
                  </ExtLink>
                </div>
              }
            ></Alert>
            <div className="mt-20">
              <FormItem
                optionTitle={t("resource:group.detail.asg.asgTipsTitle")}
                optionDesc=""
              >
                <CodeCopy loading={loading} code={guide} />
              </FormItem>
            </div>
          </>
        ) : loading ? (
          <LoadingText />
        ) : (
          <Alert
            title=""
            content={
              <div>
                {t("resource:group.detail.asg.asgCreateIngestTip1")}
                <Link to="/log-pipeline/application-log">
                  {t("resource:group.detail.asg.asgCreateIngestTip2")}
                </Link>
                {t("resource:group.detail.asg.asgCreateIngestTip3")}
              </div>
            }
          ></Alert>
        )}
      </>
    </HeaderPanel>
  );
};

export default ASGGuide;
