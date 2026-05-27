import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
  IonAlert,
} from "@ionic/react";
import {
  alertCircleOutline,
  checkmarkCircle,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { useHistory, useLocation } from "react-router-dom";
import { Agent } from "../../../core/agent/agent";
import { useAppDispatch } from "../../../store/hooks";
import { setFaydaVerified } from "../../../store/reducers/faydaVerifiedCache";
import { setNotificationsCache } from "../../../store/reducers/notificationsCache";
import {
  buildIdentityVerificationNativeCallbackUri,
  CANDOUR_BRIDGE_TO_APP_QUERY_PARAM,
  CANDOUR_SESSION_ID_STORAGE_KEY,
  IDENTITY_PENDING_CONNECTION_ID_STORAGE_KEY,
  IDENTITY_PENDING_CONNECTION_LABEL_STORAGE_KEY,
  getIdentityVerificationApiBase,
} from "../../utils/identityVerification";
import "../faydaCallback/FaydaCallback.scss";

const CANDOUR_ISSUER_API_BASE = getIdentityVerificationApiBase("candour");
const SAVE_CANDOUR_DATA_ENDPOINT = `${CANDOUR_ISSUER_API_BASE}/saveCandour`;

export const CandourCallback = () => {
  const dispatch = useAppDispatch();
  const history = useHistory();
  const location = useLocation();
  const hasHandledCallback = useRef(false);
  const callbackSearch = location.search;
  const callbackParams = new URLSearchParams(callbackSearch);
  const shouldBridgeToNativeApp =
    !Capacitor.isNativePlatform() &&
    callbackParams.get(CANDOUR_BRIDGE_TO_APP_QUERY_PARAM) === "1";
  const nativeCallbackUri = buildIdentityVerificationNativeCallbackUri(
    "candour",
    callbackParams
  );

  const [status, setStatus] = useState("Processing Candour verification...");
  const [error, setError] = useState<string | null>(null);
  const [showIssuedModal, setShowIssuedModal] = useState(false);
  const [completionDestination, setCompletionDestination] = useState<
    "notifications" | "menu" | null
  >(null);

  const waitForGrantNotification = async (
    issuerAid: string,
    knownNotificationIds: Set<string>
  ): Promise<boolean> => {
    const timeoutAt = Date.now() + 8000;

    while (Date.now() < timeoutAt) {
      const notifications = await Agent.agent.keriaNotifications
        .getNotifications()
        .catch(() => []);

      dispatch(setNotificationsCache(notifications));

      const hasMatchingGrant = notifications.some((notification) => {
        const route = String(notification.a?.r || "").trim();
        if (route !== "/exn/ipex/grant") {
          return false;
        }
        if (knownNotificationIds.has(notification.id)) {
          return false;
        }
        if (issuerAid && notification.connectionId !== issuerAid) {
          return false;
        }

        return true;
      });

      if (hasMatchingGrant) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return false;
  };

  useEffect(() => {
    if (!shouldBridgeToNativeApp) {
      return;
    }

    setStatus("Returning to Fairway Wallet...");
    window.location.replace(nativeCallbackUri);
  }, [nativeCallbackUri, shouldBridgeToNativeApp]);

  useEffect(() => {
    if (shouldBridgeToNativeApp) {
      return;
    }

    if (hasHandledCallback.current) {
      return;
    }
    hasHandledCallback.current = true;

    void finalizeCandourVerification();
  }, [shouldBridgeToNativeApp]);

  const finalizeCandourVerification = async () => {
    const currentCallbackParams = new URLSearchParams(callbackSearch);
    const callbackStatus = String(
      currentCallbackParams.get("status") || ""
    ).trim();
    if (
      callbackStatus === "cancelled" ||
      callbackStatus === "cancelledUnsupportedDevice" ||
      callbackStatus === "cancelledUnsupportedId"
    ) {
      setError(`Candour verification was cancelled (${callbackStatus}).`);
      return;
    }

    const holderAid = (sessionStorage.getItem("fayda_holder_aid") || "").trim();
    const verificationSessionId = String(
      currentCallbackParams.get("verificationSessionId") ||
        currentCallbackParams.get("sessionId") ||
        currentCallbackParams.get("guid") ||
        currentCallbackParams.get("invitationGuid") ||
        sessionStorage.getItem(CANDOUR_SESSION_ID_STORAGE_KEY) ||
        ""
    ).trim();

    let pendingIssuerAid = "";
    try {
      pendingIssuerAid = String(
        window.localStorage.getItem(
          IDENTITY_PENDING_CONNECTION_ID_STORAGE_KEY
        ) || ""
      ).trim();
    } catch {
      pendingIssuerAid = "";
    }

    if (!holderAid) {
      setError("No connection found for Candour credential issuance.");
      return;
    }
    if (!verificationSessionId) {
      setError("Candour callback did not include a verification session id.");
      return;
    }

    try {
      setStatus("Finalizing Candour verification...");
      const existingNotificationIds = new Set(
        (
          await Agent.agent.keriaNotifications
            .getNotifications()
            .catch(() => [])
        ).map((notification) => notification.id)
      );

      const issueResponse = await fetch(SAVE_CANDOUR_DATA_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aid: holderAid,
          issuerAid: pendingIssuerAid || undefined,
          verificationSessionId,
        }),
      });

      const issuePayload = await issueResponse.json().catch(() => null);
      if (!issueResponse.ok) {
        throw new Error(
          String(
            issuePayload?.data?.message ||
              issuePayload?.data ||
              issuePayload?.message ||
              "Unable to finalize Candour verification"
          )
        );
      }

      const issueData = issuePayload?.data || {};
      const hasIssuedCredential = Boolean(
        issueData?.autoIssued ||
          issueData?.alreadyIssued ||
          issueData?.credentialId
      );
      const canFinalizeConnection = Boolean(issueData?.verified);
      const backendMessage = String(issueData?.message || "").trim();

      let grantNotificationVisible = !hasIssuedCredential;
      if (hasIssuedCredential) {
        setStatus("Waiting for credential offer...");
        grantNotificationVisible = await waitForGrantNotification(
          pendingIssuerAid,
          existingNotificationIds
        );
      }

      dispatch(setFaydaVerified(canFinalizeConnection));
      setCompletionDestination(hasIssuedCredential ? "notifications" : "menu");
      setShowIssuedModal(hasIssuedCredential && grantNotificationVisible);
      setStatus(
        grantNotificationVisible
          ? backendMessage ||
              (hasIssuedCredential
                ? "Candour credential offer sent."
                : issueData?.pendingManualReview
                ? "Candour verification completed. The issuer must finish this credential manually."
                : "Candour verification completed.")
          : "Candour verification completed. Credential sync is still in progress."
      );

      sessionStorage.removeItem(CANDOUR_SESSION_ID_STORAGE_KEY);
      try {
        window.localStorage.removeItem(
          IDENTITY_PENDING_CONNECTION_LABEL_STORAGE_KEY
        );
      } catch {
        // no-op
      }
    } catch (finalizeError) {
      dispatch(setFaydaVerified(false));
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : "Unable to finalize Candour verification"
      );
    }
  };

  return (
    <IonPage className="fayda-callback-page">
      <IonContent
        fullscreen
        className="fayda-callback-content"
      >
        <div className="fayda-callback-shell">
          {!error && (
            <section
              className={`fayda-callback-panel fayda-callback-panel--${
                completionDestination ? "success" : "progress"
              }`}
            >
              <div className="fayda-callback-panel-badge">
                <IonIcon
                  icon={
                    completionDestination
                      ? checkmarkCircle
                      : shieldCheckmarkOutline
                  }
                />
              </div>

              <IonText className="fayda-callback-message">
                <p>{status}</p>
              </IonText>

              {!completionDestination && (
                <div className="fayda-callback-spinner-wrap">
                  <IonSpinner name="crescent" />
                </div>
              )}

              <div className="fayda-callback-actions">
                {shouldBridgeToNativeApp && (
                  <IonButton
                    expand="block"
                    className="fayda-callback-button fayda-callback-button--primary"
                    href={nativeCallbackUri}
                  >
                    Open Fairway Wallet
                  </IonButton>
                )}

                {completionDestination === "notifications" && (
                  <IonButton
                    expand="block"
                    className="fayda-callback-button fayda-callback-button--primary"
                    onClick={() => history.replace("/tabs/notifications")}
                  >
                    Open notifications
                  </IonButton>
                )}

                {completionDestination && (
                  <IonButton
                    expand="block"
                    fill="outline"
                    className="fayda-callback-button fayda-callback-button--secondary"
                    onClick={() => history.replace("/tabs/menu")}
                  >
                    Back to menu
                  </IonButton>
                )}
              </div>
            </section>
          )}

          {error && (
            <section className="fayda-callback-panel fayda-callback-panel--error">
              <div className="fayda-callback-panel-badge">
                <IonIcon icon={alertCircleOutline} />
              </div>

              <IonText
                color="danger"
                className="fayda-callback-message"
              >
                <p>{error}</p>
              </IonText>

              <div className="fayda-callback-actions">
                <IonButton
                  expand="block"
                  className="fayda-callback-button fayda-callback-button--primary"
                  onClick={() => history.replace("/tabs/menu")}
                >
                  Back to connections
                </IonButton>
              </div>
            </section>
          )}
        </div>

        <IonAlert
          isOpen={showIssuedModal}
          header="Candour credential issued"
          message="A credential offer has arrived. Open notifications now to review and accept it."
          buttons={[
            {
              text: "Check notifications",
              handler: () => history.replace("/tabs/notifications"),
            },
            {
              text: "Later",
              role: "cancel",
              handler: () => history.replace("/tabs/menu"),
            },
          ]}
          onDidDismiss={() => setShowIssuedModal(false)}
        />
      </IonContent>
    </IonPage>
  );
};
