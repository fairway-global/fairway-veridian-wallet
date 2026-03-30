import {
  calendarNumberOutline,
  informationCircleOutline,
  keyOutline,
} from "ionicons/icons";
import { IonButton } from "@ionic/react";
import { useState } from "react";
import { JSONObject } from "../../../../core/agent/agent.types";
import { i18n } from "../../../../i18n";
import { useAppSelector } from "../../../../store/hooks";
import { getIdentifiersCache } from "../../../../store/reducers/identifiersCache";
import {
  formatShortDate,
  formatTimeToSec,
  getUTCOffset,
} from "../../../utils/formatters";
import { getTheme } from "../../../utils/theme";
import { Alert } from "../../Alert";
import {
  CardBlock,
  CardDetailsBlock,
  CardDetailsExpandAttributes,
  CardDetailsItem,
} from "../../CardDetails";
import { CardTheme } from "../../CardTheme";
import { FallbackIcon } from "../../FallbackIcon";
import { IdentifierDetailModal } from "../../IdentifierDetailModule";
import { ListHeader } from "../../ListHeader";
import {
  CredentialContentProps,
  IssuedIdentifierProps,
  IssuerProps,
} from "./CredentialContent.types";
import { MultisigMember } from "./MultisigMember";
import { MemberAcceptStatus } from "./MultisigMember.types";

const IGNORE_KEYS = ["i", "dt", "d", "u"];

const RelatedIdentifier = ({ identifierId }: IssuedIdentifierProps) => {
  const identifiers = useAppSelector(getIdentifiersCache);
  const [openIdentifierDetail, setOpenIdentifierDetail] = useState(false);
  const identifier = identifiers[identifierId];

  return (
    <>
      {identifier && (
        <CardBlock
          title={i18n.t("tabs.credentials.details.relatedidentifier")}
          onClick={() => setOpenIdentifierDetail(true)}
          testId="related-identifier-section"
        >
          <CardDetailsItem
            info={identifier?.displayName || ""}
            className="related-identifier"
            testId="related-identifier-name"
            startSlot={<CardTheme {...getTheme(identifier.theme || 0)} />}
          />
        </CardBlock>
      )}
      <IdentifierDetailModal
        isOpen={openIdentifierDetail}
        setIsOpen={setOpenIdentifierDetail}
        identifierDetailId={identifierId}
        pageId="credential-related-identifier"
      />
    </>
  );
};

const Issuer = ({
  connectionShortDetails,
  setOpenConnectionlModal,
}: IssuerProps) => {
  const [showMissingIssuerModal, setShowMissingIssuerModal] = useState(false);

  const openConnection = () => {
    if (connectionShortDetails) {
      setOpenConnectionlModal(true);
    } else {
      setShowMissingIssuerModal(true);
    }
  };

  const closeAlert = () => setShowMissingIssuerModal(false);

  return (
    <>
      <CardBlock
        title={i18n.t("tabs.credentials.details.issuer")}
        onClick={openConnection}
        testId="issuer"
      >
        <CardDetailsItem
          info={
            connectionShortDetails
              ? connectionShortDetails.label
              : i18n.t("connections.unknown")
          }
          startSlot={<FallbackIcon />}
          className="member"
          testId={"credential-details-issuer"}
        />
      </CardBlock>
      <Alert
        dataTestId="cred-missing-issuer-alert"
        headerText={i18n.t("tabs.credentials.details.alert.missingissuer.text")}
        confirmButtonText={`${i18n.t(
          "tabs.credentials.details.alert.missingissuer.confirm"
        )}`}
        isOpen={showMissingIssuerModal}
        setIsOpen={setShowMissingIssuerModal}
        actionConfirm={closeAlert}
        actionDismiss={closeAlert}
      />
    </>
  );
};

const CredentialContent = ({
  cardData,
  joinedCredRequestMembers,
  connectionShortDetails,
  setOpenConnectionlModal,
}: CredentialContentProps) => {
  const issuedAt = `${formatShortDate(cardData.a.dt)} - ${formatTimeToSec(
    cardData.a.dt
  )} (${getUTCOffset(cardData.a.dt)})`;
  const [showAboutDetails, setShowAboutDetails] = useState(false);
  const description = String(cardData.s.description || "").trim();

  return (
    <>
      <ListHeader title={i18n.t("tabs.credentials.details.about")} />
      <CardBlock
        title={i18n.t("tabs.credentials.details.type")}
        testId="credential-details-about"
        className="credential-details-about-block"
      >
        <CardDetailsItem
          info={cardData.s.title}
          testId="credential-details-type"
          icon={informationCircleOutline}
          mask={false}
          fullText={false}
        />
        {showAboutDetails && (
          <div
            className="credential-details-about-expanded"
            data-testid="credential-details-about-expanded"
          >
            <CardDetailsItem
              keyValue={`${i18n.t("tabs.credentials.details.name")}:`}
              info={cardData.s.title}
              testId="credential-about-name"
              mask={false}
              fullText={true}
            />
            <CardDetailsItem
              keyValue={`${i18n.t("tabs.credentials.details.id")}:`}
              info={cardData.id}
              testId="credential-about-id"
              mask={false}
              fullText={true}
            />
            <CardDetailsItem
              keyValue={`${i18n.t("tabs.credentials.details.issuer")}:`}
              info={
                connectionShortDetails
                  ? connectionShortDetails.label
                  : i18n.t("connections.unknown")
              }
              testId="credential-about-issuer"
              mask={false}
              fullText={true}
            />
            <CardDetailsItem
              keyValue={`${i18n.t("tabs.credentials.details.status.issued")}:`}
              info={issuedAt}
              testId="credential-about-issued"
              mask={false}
              fullText={true}
            />
            {description && (
              <div
                className="credential-details-about-description"
                data-testid="credential-about-description"
              >
                <p className="credential-details-about-description-label">
                  {i18n.t("tabs.credentials.details.description")}
                </p>
                <p className="credential-details-about-description-text">
                  {description}
                </p>
              </div>
            )}
          </div>
        )}
        <div className="credential-details-about-toggle">
          <IonButton
            className="credential-details-about-toggle-button"
            data-testid="credential-details-about-toggle-button"
            onClick={() => setShowAboutDetails((current) => !current)}
          >
            {showAboutDetails
              ? i18n.t("readmore.less")
              : i18n.t("readmore.more")}
          </IonButton>
        </div>
      </CardBlock>
      {joinedCredRequestMembers && joinedCredRequestMembers.length > 0 && (
        <CardDetailsBlock
          title={i18n.t("tabs.credentials.details.joinedmember")}
        >
          {joinedCredRequestMembers?.map((member) => (
            <MultisigMember
              key={member.aid}
              name={member.name}
              status={MemberAcceptStatus.Accepted}
            />
          ))}
        </CardDetailsBlock>
      )}
      <ListHeader title={i18n.t("tabs.credentials.details.attributes.label")} />
      <CardBlock title={i18n.t("tabs.credentials.details.attributes.title")}>
        <CardDetailsExpandAttributes
          data={cardData.a as JSONObject}
          ignoreKeys={IGNORE_KEYS}
          openLevels={[1]}
        />
      </CardBlock>
      <ListHeader
        title={i18n.t("tabs.credentials.details.credentialdetails")}
      />
      <CardBlock
        title={i18n.t("tabs.credentials.details.status.issued")}
        testId={"credential-issued-label"}
      >
        <CardDetailsItem
          keyValue={formatShortDate(cardData.a.dt)}
          info={`${formatTimeToSec(cardData.a.dt)} (${getUTCOffset(cardData.a.dt)})`}
          testId={"credential-issued-section"}
          icon={calendarNumberOutline}
          className="credential-issued-section"
          mask={false}
          fullText
        />
      </CardBlock>
      <Issuer
        connectionShortDetails={connectionShortDetails}
        setOpenConnectionlModal={setOpenConnectionlModal}
      />
      <div className="credential-details-split-section">
        <CardBlock
          copyContent={cardData.id}
          title={i18n.t("tabs.credentials.details.id")}
          testId={"credential-details-id-block"}
        >
          <CardDetailsItem
            info={`${cardData.id.substring(0, 5)}...${cardData.id.slice(-5)}`}
            icon={keyOutline}
            testId={"credential-details-id"}
            className="credential-details-id"
            mask={false}
          />
        </CardBlock>
        <CardBlock
          title={i18n.t("tabs.credentials.details.schemaversion")}
          testId="schema-version"
        >
          <h2 data-testid="credential-details-schema-version">
            {cardData.s.version}
          </h2>
        </CardBlock>
      </div>
      <CardBlock
        title={i18n.t("tabs.credentials.details.status.label")}
        testId={"credential-details-last-status-label"}
      >
        <h2 data-testid="credential-details-last-status">
          {cardData.lastStatus.s === "0"
            ? i18n.t("tabs.credentials.details.status.issued")
            : i18n.t("tabs.credentials.details.status.revoked")}
        </h2>
        <p data-testid="credential-details-last-status-timestamp">
          {`${i18n.t(
            "tabs.credentials.details.status.timestamp"
          )} ${formatShortDate(cardData.lastStatus.dt)} - ${formatTimeToSec(
            cardData.lastStatus.dt
          )} (${getUTCOffset(cardData.lastStatus.dt)})`}
        </p>
      </CardBlock>
      <RelatedIdentifier identifierId={cardData.identifierId} />
    </>
  );
};

export { CredentialContent };
