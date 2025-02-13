import React from "react";
import Switch from "components/Switch/switch";
import HeaderPanel from "components/HeaderPanel";
import { ExLogConf } from "./LogConfigComp";
import { useTranslation } from "react-i18next";
import Select from "components/Select";
import { FILTER_CONDITION_LIST } from "assets/js/const";
import TextInput from "components/TextInput";
import {
  LogConfFilter,
  LogConfFilterCondition,
  LogConfFilterInput,
  ProcessorFilterRegexInput,
} from "API";
import Button from "components/Button";
import { InfoBarTypes } from "reducer/appReducer";

interface ConfigFilterProps {
  logConfig: ExLogConf;
  changeFilter: (filter: ProcessorFilterRegexInput) => void;
}

const ConfigFilter: React.FC<ConfigFilterProps> = (
  props: ConfigFilterProps
) => {
  const { logConfig, changeFilter } = props;
  const { t } = useTranslation();

  const changeCurrentFilter = (filters: LogConfFilterInput[]) => {
    changeFilter({
      enable: logConfig.processorFilterRegex?.enable ? true : false,
      filters: filters,
    });
  };

  return (
    <HeaderPanel
      title={t("resource:config.filter.name")}
      infoType={InfoBarTypes.CONFIG_FILTER}
    >
      <>
        <Switch
          label={t("resource:config.filter.enabled")}
          desc={t("resource:config.filter.desc")}
          isOn={logConfig.processorFilterRegex?.enable || false}
          handleToggle={() => {
            console.info("toggle");
            const tmpFilter: any = logConfig.processorFilterRegex;
            tmpFilter.enable = !logConfig.processorFilterRegex?.enable;
            changeFilter(tmpFilter);
          }}
        />
        {logConfig.processorFilterRegex?.enable && (
          <>
            <div className="flex show-tag-list top-header">
              <div className="tag-key log">
                <b>{t("resource:config.filter.key")}</b>
              </div>
              <div className="tag-key log">
                <b>{t("resource:config.filter.condition")}</b>
              </div>
              <div className="tag-value flex-1">
                <b>{t("resource:config.filter.regex")}</b>
              </div>
            </div>
            {logConfig.processorFilterRegex?.filters?.map(
              (element: any, index: number) => {
                return (
                  <div key={index} className="flex show-tag-list no-stripe">
                    <div className="tag-key log">
                      <div className="pr-20">
                        <Select
                          optionList={logConfig.selectKeyList?.slice(1) || []}
                          value={element.key}
                          onChange={(event) => {
                            console.info("event:", event);
                            const tmpFilterArr: LogConfFilter[] = JSON.parse(
                              JSON.stringify(
                                logConfig.processorFilterRegex?.filters
                              )
                            );
                            tmpFilterArr[index].key = event.target.value || "";
                            changeCurrentFilter(tmpFilterArr);
                          }}
                          placeholder="Select Key"
                        />
                      </div>
                    </div>
                    <div className="tag-key log pr-20">
                      <Select
                        isI18N
                        optionList={FILTER_CONDITION_LIST}
                        value={
                          element?.condition || LogConfFilterCondition.Include
                        }
                        onChange={(event) => {
                          console.info("event:", event);
                          const tmpFilterArr: LogConfFilter[] = JSON.parse(
                            JSON.stringify(
                              logConfig.processorFilterRegex?.filters
                            )
                          );
                          tmpFilterArr[index].condition =
                            event.target.value || "";
                          changeCurrentFilter(tmpFilterArr);
                        }}
                        placeholder="Condition"
                      />
                    </div>
                    <div className="tag-value log flex-1">
                      <div>
                        <TextInput
                          placeholder="\S\s+."
                          value={element?.value || ""}
                          onChange={(event) => {
                            const tmpFilterArr: LogConfFilter[] = JSON.parse(
                              JSON.stringify(
                                logConfig.processorFilterRegex?.filters
                              )
                            );
                            tmpFilterArr[index].value =
                              event.target.value || "";
                            changeCurrentFilter(tmpFilterArr);
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <Button
                        className="ml-10"
                        onClick={() => {
                          const tmpFilterArr: LogConfFilterInput[] = JSON.parse(
                            JSON.stringify(
                              logConfig.processorFilterRegex?.filters
                            )
                          );
                          tmpFilterArr.splice(index, 1);
                          changeCurrentFilter(tmpFilterArr);
                        }}
                      >
                        {t("button.remove")}
                      </Button>
                    </div>
                  </div>
                );
              }
            )}
            <div>
              <Button
                className="ml-20 mt-10"
                onClick={() => {
                  const tmpFilterArr: LogConfFilterInput[] = JSON.parse(
                    JSON.stringify(logConfig.processorFilterRegex?.filters)
                  );
                  tmpFilterArr.push({
                    key: "",
                    condition: LogConfFilterCondition.Include,
                    value: "",
                  });
                  changeCurrentFilter(tmpFilterArr);
                }}
              >
                {t("button.addCondition")}
              </Button>
            </div>
          </>
        )}
      </>
    </HeaderPanel>
  );
};

export default ConfigFilter;
