import { IonCard } from "@ionic/react";
import pJson from "../../../../../../../../package.json";
import { i18n } from "../../../../../../../i18n";
import "./ReleaseInfo.scss";

const CHANGELOG_SEPARATOR = "|";

const getReleaseValue = (value?: string) => {
  const normalizedValue = String(value || "").trim();

  return normalizedValue.length > 0
    ? normalizedValue
    : i18n.t("tabs.menu.tab.settings.sections.support.releaseinfo.notset");
};

const parseChangelog = (value?: string) =>
  String(value || "")
    .split(CHANGELOG_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);

const ReleaseInfo = () => {
  const details = [
    {
      label: i18n.t("tabs.menu.tab.settings.sections.support.version"),
      value: pJson.version,
    },
    {
      label: i18n.t(
        "tabs.menu.tab.settings.sections.support.releaseinfo.releasedate"
      ),
      value: getReleaseValue(process.env.REACT_APP_RELEASE_DATE),
    },
    {
      label: i18n.t(
        "tabs.menu.tab.settings.sections.support.releaseinfo.filesize"
      ),
      value: getReleaseValue(process.env.REACT_APP_ANDROID_APK_SIZE),
    },
    {
      label: i18n.t(
        "tabs.menu.tab.settings.sections.support.releaseinfo.checksum"
      ),
      value: getReleaseValue(process.env.REACT_APP_ANDROID_APK_SHA256),
    },
  ];

  const changelog = parseChangelog(process.env.REACT_APP_RELEASE_CHANGELOG);
  const releaseDescription = getReleaseValue(
    process.env.REACT_APP_RELEASE_DESCRIPTION
  );
  const installSteps = [
    i18n.t(
      "tabs.menu.tab.settings.sections.support.releaseinfo.installsteps.download"
    ),
    i18n.t(
      "tabs.menu.tab.settings.sections.support.releaseinfo.installsteps.open"
    ),
    i18n.t(
      "tabs.menu.tab.settings.sections.support.releaseinfo.installsteps.allow"
    ),
    i18n.t(
      "tabs.menu.tab.settings.sections.support.releaseinfo.installsteps.install"
    ),
    i18n.t(
      "tabs.menu.tab.settings.sections.support.releaseinfo.installsteps.verify"
    ),
  ];

  return (
    <div className="release-info">
      <div className="settings-section-title-placeholder" />
      <IonCard>
        <p
          className="release-info-description"
          data-testid="release-info-description"
        >
          {releaseDescription}
        </p>
      </IonCard>

      <div className="settings-section-title">
        {i18n.t("tabs.menu.tab.settings.sections.support.releaseinfo.details")}
      </div>
      <IonCard data-testid="release-info-details">
        {details.map((detail) => (
          <div
            key={detail.label}
            className="release-info-detail"
          >
            <p className="release-info-detail-label">{detail.label}</p>
            <p className="release-info-detail-value">{detail.value}</p>
          </div>
        ))}
      </IonCard>

      <div className="settings-section-title">
        {i18n.t("tabs.menu.tab.settings.sections.support.releaseinfo.changelog")}
      </div>
      <IonCard data-testid="release-info-changelog">
        {changelog.length > 0 ? (
          <ul className="release-info-list">
            {changelog.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="release-info-empty">
            {i18n.t(
              "tabs.menu.tab.settings.sections.support.releaseinfo.emptychangelog"
            )}
          </p>
        )}
      </IonCard>

      <div className="settings-section-title">
        {i18n.t(
          "tabs.menu.tab.settings.sections.support.releaseinfo.installtitle"
        )}
      </div>
      <IonCard data-testid="release-info-install">
        <ol className="release-info-list release-info-ordered">
          {installSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </IonCard>
    </div>
  );
};

export { ReleaseInfo };
