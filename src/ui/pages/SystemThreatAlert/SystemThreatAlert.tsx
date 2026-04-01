import { IonIcon } from "@ionic/react";
import {
  alertCircleOutline,
  helpCircleOutline,
  warningOutline,
} from "ionicons/icons";
import React from "react";
import { i18n } from "../../../i18n";
import { CardDetailsBlock } from "../../components/CardDetails";
import { InfoCard } from "../../components/InfoCard";
import { ScrollablePageLayout } from "../../components/layout/ScrollablePageLayout";
import { PageFooter } from "../../components/PageFooter";
import "./SystemThreatAlert.scss";
import { SystemThreatAlertProps } from "./SystemThreatAlert.types";

const THREAT_SUPPORT_EMAIL =
  process.env.APP_WATCHER_MAIL || "abrham@fairway.global";

const buildThreatSupportMailTo = (errors: string[]) => {
  const subject = "Fairwallet threat alert";
  const body = [
    "A Fairwallet install triggered the threat alert screen.",
    "",
    "Detected threats:",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
  ].join("\n");

  return `mailto:${THREAT_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
};

const SystemThreatAlert: React.FC<SystemThreatAlertProps> = ({ errors }) => {
  const pageId = "system-threat-alert-page";
  const supportEmailLink = buildThreatSupportMailTo(errors);

  return (
    <ScrollablePageLayout
      activeStatus
      pageId={pageId}
    >
      <div className="alert-container">
        <IonIcon
          icon={alertCircleOutline}
          className="warning-icon"
        />
        <h2 className="title">
          {i18n.t("systemthreats.title", {
            defaultValue: "Threats Detected",
          })}
        </h2>
        <p className="description">
          {i18n.t("systemthreats.description", {
            defaultValue:
              "The following security threats have been detected on your device:",
          })}
        </p>
        <CardDetailsBlock className="system-threats">
          {errors.map((error, i) => (
            <p
              key={`threat-errortext-${i}`}
              className="threat-error"
            >
              {error}
            </p>
          ))}
        </CardDetailsBlock>
        <InfoCard
          content={i18n.t("systemthreats.alert")}
          icon={warningOutline}
        />
        <PageFooter
          primaryButtonText={`${i18n.t("systemthreats.help")}`}
          primaryButtonIcon={helpCircleOutline}
          primaryButtonAction={supportEmailLink}
        />
      </div>
    </ScrollablePageLayout>
  );
};

export { SystemThreatAlert, buildThreatSupportMailTo };
