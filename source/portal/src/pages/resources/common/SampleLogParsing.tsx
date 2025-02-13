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
import React, { useState, useEffect } from "react";
import { LogType, MultiLineLogParser } from "API";
import Button from "components/Button";
import FormItem from "components/FormItem";
import TextArea from "components/TextArea";
import TextInput from "components/TextInput";
import { InfoBarTypes } from "reducer/appReducer";
import { useTranslation } from "react-i18next";
import Select from "components/Select";
import { FB_TYPE_LIST, generateTimeZoneList } from "assets/js/const";
import Alert from "components/Alert";
import { Alert as AlertInfo } from "assets/js/alert";
import { ExLogConf } from "./LogConfigComp";
import {
  getLogFormatByUserLogConfig,
  IsJsonString,
  JsonToDotNotate,
  replaceSpringbootTimeFormat,
} from "assets/js/utils";
import { appSyncRequestQuery } from "assets/js/request";
import { checkTimeFormat } from "graphql/queries";
import { OptionType } from "components/AutoComplete/autoComplete";

export interface RegexListType {
  key: string;
  type: string;
  format: string;
  value: string;
  loadingCheck: boolean;
  showError: boolean;
  showSuccess: boolean;
}
interface SampleLogParsingProps {
  changeSpecs: (specs: any) => void;
  changeSampleLog: (log: string) => void;
  logConfig: ExLogConf;
  logType: LogType;
  showSampleLogRequiredError?: boolean;
  sampleLogInvalid: boolean;
  changeSampleLogInvalid: (valid: boolean) => void;
  changeTimeKey?: (key: string) => void;
  changeRegExpList?: (list: RegexListType[]) => void;
  changeSelectKeyList?: (list: OptionType[]) => void;
  changeTimeOffset?: (offset: string) => void;
}

const SampleLogParsing: React.FC<SampleLogParsingProps> = (
  props: SampleLogParsingProps
) => {
  const {
    logType,
    logConfig,
    showSampleLogRequiredError,
    changeSpecs,
    changeSampleLog,
    sampleLogInvalid,
    changeSampleLogInvalid,
    changeTimeKey,
    changeRegExpList,
    changeSelectKeyList,
    changeTimeOffset,
  } = props;
  const { t } = useTranslation();
  const [logResMap, setLogResMap] = useState<any>({});

  const [showValidInfo, setShowValidInfo] = useState(false);
  const [timeFormatForSpringBoot, setTimeFormatForSpringBoot] = useState("");
  const [loadingCheckTimeKeyFormat, setLoadingCheckTimeKeyFormat] =
    useState(false);
  const [timeKeyFormatInvalid, setTimeKeyFormatInvalid] = useState(false);
  const [timeKeyFormatValid, setTimeKeyFormatValid] = useState(false);

  const NOT_SUPPORT_FORMAT_STRS = ["%L"];

  const isCustomType = () => {
    return (
      logType === LogType.JSON ||
      logType === LogType.SingleLineText ||
      logType === LogType.Syslog ||
      (logConfig.logType === LogType.MultiLineText &&
        logConfig.multilineLogParser === MultiLineLogParser.CUSTOM)
    );
  };

  const isSpringBootType = () => {
    return (
      logConfig.logType === LogType.MultiLineText &&
      logConfig.multilineLogParser === MultiLineLogParser.JAVA_SPRING_BOOT
    );
  };

  const getDefaultType = (key: string, value?: string): string => {
    if (key === "time") {
      return "date";
    }
    if (value) {
      if (typeof value === "number" && isFinite(value)) {
        if (Number.isInteger(value)) {
          return "integer";
        }
        return "";
      }
    }
    if (
      logConfig.logType === LogType.MultiLineText &&
      logConfig.multilineLogParser === MultiLineLogParser.JAVA_SPRING_BOOT
    ) {
      if (key === "level") {
        return "keyword";
      }
    }
    return "text";
  };

  const convertJSONToKeyValueList = () => {
    if (!logConfig?.userSampleLog) {
      AlertInfo(t("resource:config.parsing.inputJSON"));
      return;
    }
    if (!IsJsonString(logConfig?.userSampleLog || "")) {
      AlertInfo(t("resource:config.parsing.notJSONFormat"));
      return;
    }
    const tmpJsonObj = JsonToDotNotate(
      JSON.parse(logConfig.userSampleLog || "")
    );
    console.info("tmpJsonFormat:", tmpJsonObj);
    const initArr: any = [];
    Object.keys(tmpJsonObj).forEach((key) => {
      initArr.push({
        key: key,
        type: getDefaultType(key, tmpJsonObj[key]),
        format: "",
        value: tmpJsonObj[key],
      });
    });
    changeRegExpList && changeRegExpList(initArr);
  };

  const parseLog = () => {
    const regex = logConfig.regularExpression || "";
    if (!regex.trim()) {
      return;
    }
    let isValid = true;
    try {
      new RegExp(regex);
    } catch (e) {
      isValid = false;
    }
    if (!isValid) {
      Alert(t("resource:config.parsing.alert"));
      return;
    }
    const found: any = logConfig?.userSampleLog?.match(regex);
    if (logType === LogType.Nginx || logType === LogType.Apache) {
      if (found && found.groups) {
        setShowValidInfo(true);
        changeSampleLogInvalid(false);
      } else {
        setShowValidInfo(false);
        changeSampleLogInvalid(true);
      }
      setLogResMap(found?.groups || {});
      if (found && found.groups) {
        changeRegExpList &&
          changeRegExpList(
            Object.entries(found.groups).map((key) => {
              return { key: key[0] } as any;
            })
          );
      }
    }
    if (
      logType === LogType.SingleLineText ||
      logType === LogType.Syslog ||
      logType === LogType.MultiLineText
    ) {
      const initArr: RegexListType[] = [];
      if (found && found.groups) {
        setShowValidInfo(true);
        changeSampleLogInvalid(false);
        const foundObjectList = Object.entries(found.groups);
        if (foundObjectList.length) {
          console.info("foundObjectList:", foundObjectList);
          foundObjectList.forEach((element: any) => {
            initArr.push({
              key: element[0],
              type: getDefaultType(element[0], element[1]),
              format: "",
              value:
                element[1]?.length > 450
                  ? element[1].substr(0, 448) + "..."
                  : element[1],
              loadingCheck: false,
              showError: false,
              showSuccess: false,
            });
          });
        }
      } else {
        setShowValidInfo(false);
        changeSampleLogInvalid(true);
      }
      changeRegExpList && changeRegExpList(initArr);
    }
  };

  const validateTimeFormat = async (
    index: number,
    timeStr: string,
    formatStr: string
  ) => {
    if (logConfig.regexKeyList) {
      const tmpDataLoading: RegexListType[] = JSON.parse(
        JSON.stringify(logConfig.regexKeyList)
      );
      tmpDataLoading[index].loadingCheck = true;
      changeRegExpList && changeRegExpList(tmpDataLoading);
      const resData: any = await appSyncRequestQuery(checkTimeFormat, {
        timeStr: timeStr,
        formatStr: formatStr,
      });
      const tmpDataRes: RegexListType[] = JSON.parse(
        JSON.stringify(logConfig.regexKeyList)
      );
      tmpDataRes[index].loadingCheck = false;
      tmpDataRes[index].showSuccess =
        resData?.data?.checkTimeFormat?.isMatch || false;
      tmpDataRes[index].showError = !resData?.data?.checkTimeFormat?.isMatch;
      changeRegExpList && changeRegExpList(tmpDataRes);
      console.info("resData:", resData);
    }
  };

  const validTimeKeyFormat = async () => {
    if (logConfig.regexKeyList) {
      const timeStr = logConfig.regexKeyList.find(
        (element) => element.key === logConfig.timeKey
      )?.value;
      const formatStr = logConfig.regexKeyList.find(
        (element) => element.key === logConfig.timeKey
      )?.format;
      setLoadingCheckTimeKeyFormat(true);
      const resData: any = await appSyncRequestQuery(checkTimeFormat, {
        timeStr: timeStr,
        formatStr: formatStr,
      });
      setLoadingCheckTimeKeyFormat(false);
      setTimeKeyFormatInvalid(
        resData?.data?.checkTimeFormat?.isMatch === false
      );
      setTimeKeyFormatValid(resData?.data?.checkTimeFormat?.isMatch === true);
      console.info("resData:", resData);
    }
  };

  useEffect(() => {
    setShowValidInfo(false);
    changeRegExpList && changeRegExpList([]);
    setLogResMap({});
    setTimeFormatForSpringBoot("");
  }, [
    logConfig.logType,
    logConfig.multilineLogParser,
    logConfig.userLogFormat,
  ]);

  useEffect(() => {
    if (logConfig.userLogFormat) {
      if (isSpringBootType()) {
        let tmpTimeFormat = getLogFormatByUserLogConfig(
          logConfig.userLogFormat
        );
        tmpTimeFormat = replaceSpringbootTimeFormat(tmpTimeFormat);
        setTimeFormatForSpringBoot(tmpTimeFormat);
      }
    }
  }, [logConfig.userLogFormat]);

  useEffect(() => {
    // set format undefine when format is empty
    if (logConfig.regexKeyList && logConfig.regexKeyList.length > 0) {
      const tmpSpecList = [];
      for (let i = 0; i < logConfig.regexKeyList.length; i++) {
        if (isSpringBootType()) {
          tmpSpecList.push({
            key: logConfig.regexKeyList[i].key,
            type: logConfig.regexKeyList[i].type,
            format:
              logConfig.regexKeyList[i].key === "time"
                ? timeFormatForSpringBoot
                : undefined,
          });
        } else {
          tmpSpecList.push({
            key: logConfig.regexKeyList[i].key,
            type: logConfig.regexKeyList[i].type,
            format: logConfig.regexKeyList[i].format
              ? logConfig.regexKeyList[i].format
              : undefined,
          });
        }
      }
      changeSpecs(tmpSpecList);
    }

    // Set Time Key Option List
    const tmpTimeKeyList: OptionType[] = [
      {
        name: t("none"),
        value: "",
      },
    ];
    logConfig?.regexKeyList?.map((element) => {
      tmpTimeKeyList.push({
        name: element.key,
        value: element.key,
      });
    });
    changeSelectKeyList && changeSelectKeyList(tmpTimeKeyList);
    setTimeKeyFormatInvalid(false);
    setTimeKeyFormatValid(false);
  }, [logConfig.regexKeyList, timeFormatForSpringBoot]);

  useEffect(() => {
    if (logConfig.logType !== LogType.JSON) {
      parseLog();
    }
  }, [logConfig?.userSampleLog]);

  return (
    <div>
      <FormItem
        infoType={
          logConfig.logType === LogType.Nginx
            ? InfoBarTypes.NGINX_SAMPLE_LOG_PARSING
            : logConfig.logType === LogType.Apache
            ? InfoBarTypes.APACHE_SAMPLE_LOG_PARSING
            : undefined
        }
        optionTitle={`${t("resource:config.parsing.sampleLog")}${
          logConfig.logType === LogType.Nginx ||
          logConfig.logType === LogType.Apache
            ? " - " + t("optional")
            : ""
        }`}
        optionDesc={
          logConfig.logType === LogType.JSON
            ? t("resource:config.parsing.sampleLogJSONDesc")
            : t("resource:config.parsing.sampleLogDesc")
        }
        successText={
          showValidInfo && !sampleLogInvalid
            ? t("resource:config.parsing.valid")
            : ""
        }
        errorText={
          showSampleLogRequiredError
            ? t("resource:config.parsing.sampleRequired")
            : sampleLogInvalid
            ? t("resource:config.parsing.invalid")
            : ""
        }
      >
        <div className="flex m-w-75p">
          <div style={{ flex: 1 }}>
            <TextArea
              value={logConfig.userSampleLog || ""}
              placeholder=""
              rows={3}
              onChange={(event) => {
                changeSampleLogInvalid(false);
                setShowValidInfo(false);
                changeSampleLog(event.target.value);
                // changeRegExpList && changeRegExpList([]);
              }}
            />
          </div>
          <div className="ml-10">
            <Button
              onClick={() => {
                if (logConfig.logType === LogType.JSON) {
                  convertJSONToKeyValueList();
                } else {
                  parseLog();
                }
              }}
            >
              {t("button.parseLog")}
            </Button>
          </div>
        </div>
      </FormItem>

      <FormItem
        optionTitle={t("resource:config.parsing.parseLog")}
        optionDesc={t("resource:config.parsing.parseLogDesc")}
      >
        <div>
          <div className="flex show-tag-list">
            <div className="tag-key log">
              <b>{t("resource:config.parsing.key")}</b>
            </div>
            {(logType === LogType.JSON ||
              logType === LogType.SingleLineText ||
              logType === LogType.MultiLineText) && (
              <div className="tag-key log">
                <b>{t("resource:config.parsing.type")}</b>
              </div>
            )}
            <div className="tag-value flex-1">
              <b>{t("resource:config.parsing.value")}</b>
            </div>
          </div>
          {(logType === LogType.Nginx || logType === LogType.Apache) &&
            Object.keys(logResMap).map((item: any, index: number) => {
              return (
                <div key={index} className="flex show-tag-list no-stripe">
                  <div className="tag-key log">
                    <div>{item}</div>
                  </div>
                  <div className="tag-value flex-1">{logResMap[item]}</div>
                </div>
              );
            })}

          {(logType === LogType.JSON ||
            logType === LogType.Syslog ||
            logType === LogType.SingleLineText ||
            logType === LogType.MultiLineText) &&
            logConfig?.regexKeyList?.map((item: any, index: number) => {
              return (
                <div
                  key={index}
                  className="flex show-tag-list flex-start no-stripe has-border-bottom"
                >
                  <div className="tag-key log">
                    <div className="pr-20">
                      <TextInput
                        disabled={isSpringBootType() && item.key === "time"}
                        value={item.key}
                        onChange={(event) => {
                          const tmpArr = JSON.parse(
                            JSON.stringify(logConfig.regexKeyList)
                          );
                          tmpArr[index].key = event.target.value;
                          changeRegExpList && changeRegExpList(tmpArr);
                        }}
                      />
                    </div>
                  </div>
                  <div className="tag-key log">
                    <div className="pr-20">
                      {isSpringBootType() ? (
                        FB_TYPE_LIST.find(
                          (element) => element.value === item.type
                        )?.name || ""
                      ) : (
                        <Select
                          optionList={FB_TYPE_LIST}
                          value={item.type}
                          onChange={(event) => {
                            const tmpArr = JSON.parse(
                              JSON.stringify(logConfig.regexKeyList)
                            );
                            // set format to empty when change type
                            tmpArr[index].format = "";
                            tmpArr[index].type = event.target.value;
                            changeRegExpList && changeRegExpList(tmpArr);
                          }}
                          placeholder="type"
                        />
                      )}
                    </div>
                  </div>
                  <div className="tag-value flex-1">
                    <div>
                      <div className="min-height">{item.value}</div>
                      {item.type === "date" && isCustomType() && (
                        <div className="m-w-75p">
                          <FormItem
                            key={index}
                            optionTitle={`${t(
                              "resource:config.parsing.timeFormat"
                            )}`}
                            optionDesc={""}
                            infoType={InfoBarTypes.CONFIG_TIME_FORMAT}
                            successText={
                              item.showSuccess
                                ? t("resource:config.parsing.formatSuccess")
                                : ""
                            }
                            errorText={
                              item.showError
                                ? t("resource:config.parsing.formatError")
                                : ""
                            }
                          >
                            <div className="flex">
                              <div className="flex-1">
                                <TextInput
                                  value={item.format}
                                  placeholder="%Y-%m-%d %H:%M:%S"
                                  onChange={(event) => {
                                    const tmpArr = JSON.parse(
                                      JSON.stringify(logConfig.regexKeyList)
                                    );
                                    tmpArr[index].showSuccess = false;
                                    tmpArr[index].showError = false;
                                    tmpArr[index].format =
                                      event.target.value || undefined;
                                    changeRegExpList &&
                                      changeRegExpList(tmpArr);
                                  }}
                                />
                              </div>
                              <div className="pl-10">
                                {
                                  <Button
                                    disabled={NOT_SUPPORT_FORMAT_STRS.some(
                                      (substring) =>
                                        item?.format?.includes(substring)
                                    )}
                                    loadingColor="#666"
                                    loading={item.loadingCheck}
                                    onClick={() => {
                                      validateTimeFormat(
                                        index,
                                        item.value,
                                        item.format
                                      );
                                    }}
                                  >
                                    {t("button.validate")}
                                  </Button>
                                }
                              </div>
                            </div>
                          </FormItem>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </FormItem>

      {logConfig.regexKeyList &&
        logConfig.regexKeyList.length > 0 &&
        isCustomType() && (
          <div>
            <FormItem
              optionTitle={t("resource:config.parsing.timeKey")}
              optionDesc={t("resource:config.parsing.timeKeyDesc")}
              successText={
                timeKeyFormatValid
                  ? t("resource:config.parsing.formatSuccess")
                  : ""
              }
              errorText={
                timeKeyFormatInvalid
                  ? t("resource:config.parsing.formatError")
                  : ""
              }
            >
              <div className="flex m-w-75p">
                <div className="flex-1" style={{ maxWidth: 330 }}>
                  <Select
                    allowEmpty
                    placeholder={t("resource:config.parsing.selectTimeKey")}
                    optionList={logConfig.selectKeyList || []}
                    value={logConfig.timeKey || ""}
                    onChange={(event) => {
                      setTimeKeyFormatInvalid(false);
                      setTimeKeyFormatValid(false);
                      const tmpArr = JSON.parse(
                        JSON.stringify(logConfig.regexKeyList)
                      );
                      tmpArr.forEach((element: any) => {
                        element.format =
                          element.type !== "date" ? undefined : element.format;
                      });
                      changeRegExpList && changeRegExpList(tmpArr);
                      changeTimeKey && changeTimeKey(event.target.value);
                    }}
                  />
                </div>
                {logConfig?.regexKeyList?.find(
                  (element) => element.key === logConfig.timeKey
                )?.type !== "date" &&
                  logConfig.timeKey && (
                    <>
                      <div className="flex-1 pl-10">
                        <TextInput
                          placeholder="%Y-%m-%d %H:%M:%S"
                          value={
                            logConfig.regexKeyList.find(
                              (element) => element.key === logConfig.timeKey
                            )?.format || ""
                          }
                          onChange={(event) => {
                            if (logConfig.regexKeyList) {
                              const tmpArr = JSON.parse(
                                JSON.stringify(logConfig.regexKeyList)
                              );
                              const index = logConfig.regexKeyList.findIndex(
                                (element) => element.key === logConfig.timeKey
                              );
                              tmpArr[index].format =
                                event.target.value || undefined;
                              setTimeKeyFormatInvalid(false);
                              setTimeKeyFormatValid(false);
                              changeRegExpList && changeRegExpList(tmpArr);
                            }
                          }}
                        />
                      </div>
                      <div className="pl-10">
                        <Button
                          disabled={
                            !logConfig.timeKey ||
                            !logConfig.regexKeyList.find(
                              (element) => element.key === logConfig.timeKey
                            )?.format ||
                            NOT_SUPPORT_FORMAT_STRS.some((substring) =>
                              logConfig?.regexKeyList
                                ?.find(
                                  (element) => element.key === logConfig.timeKey
                                )
                                ?.format?.includes(substring)
                            )
                          }
                          loadingColor="#666"
                          loading={loadingCheckTimeKeyFormat}
                          onClick={() => {
                            validTimeKeyFormat();
                          }}
                        >
                          {t("button.validate")}
                        </Button>
                      </div>
                    </>
                  )}
              </div>
            </FormItem>
            <div className="mt-20">
              <Alert content={t("resource:config.parsing.timeKeyTips")} />
            </div>
          </div>
        )}

      {(isCustomType() ||
        logConfig.multilineLogParser ===
          MultiLineLogParser.JAVA_SPRING_BOOT) && (
        <FormItem
          optionTitle={t("resource:config.parsing.timezone")}
          optionDesc={t("resource:config.parsing.timezoneDesc")}
        >
          <Select
            className="m-w-35p"
            placeholder={t("resource:config.parsing.selectTimezone")}
            optionList={generateTimeZoneList()}
            value={logConfig.timeOffset || ""}
            onChange={(event) => {
              changeTimeOffset && changeTimeOffset(event.target.value);
            }}
          ></Select>
        </FormItem>
      )}
    </div>
  );
};

export default SampleLogParsing;
