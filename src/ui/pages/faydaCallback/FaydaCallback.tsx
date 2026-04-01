import { useEffect, useRef, useState } from "react";
import { Agent } from "../../../core/agent/agent";
import { i18n } from "../../../i18n";
import { useAppDispatch } from "../../../store/hooks";
import { setFaydaVerified } from "../../../store/reducers/faydaVerifiedCache";
import { setNotificationsCache } from "../../../store/reducers/notificationsCache";
import { useLocation, useHistory } from "react-router-dom";
import {
  IonAlert,
  IonPage,
  IonContent,
  IonSpinner,
  IonText,
  IonButton,
  IonIcon,
} from "@ionic/react";
import {
  alertCircleOutline,
  checkmarkCircle,
  personCircleOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import * as jose from "jose";
import "./FaydaCallback.scss";

// ===== CONFIG =====
const FAYDA_AUTH_API_BASE = (
  process.env.REACT_APP_FAYDA_AUTH_API ||
  process.env.REACT_APP_BACKEND_API ||
  "http://localhost:3001"
).trim().replace(/\/+$/, "");
const FAYDA_ISSUER_API_BASE = (
  process.env.REACT_APP_FAYDA_ISSUER_API || "http://localhost:3001"
).trim().replace(/\/+$/, "");

const TOKEN_ENDPOINT = `${FAYDA_AUTH_API_BASE}/token`;
const USERINFO_ENDPOINT = `${FAYDA_AUTH_API_BASE}/userinfo`;
const SAVE_FAYDA_DATA_ENDPOINT = `${FAYDA_ISSUER_API_BASE}/saveFayda`;

const SESSION_KEYS = {
  state: "fayda_state",
  verifier: "fayda_pkce_verifier",
};
const FAYDA_PENDING_CONNECTION_ID_STORAGE_KEY = "fayda_pending_connection_id";

type FaydaProfile = {
  id?: string;
  fayda_id?: string;
  sub?: string;
  name?: string;
  email?: string;
  phone_number?: string;
  picture?: string;
  birthdate?: string;
  gender?: string;
};

// eslint-disable-next-line no-console

export const FaydaCallback = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const history = useHistory();
  const hasHandledCallback = useRef(false);
  const tr = (key: string) => String(i18n.t(key));

  const [status, setStatus] = useState(tr("faydacallback.status.processing"));
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<FaydaProfile | null>(null);
  const [issuingCredential, setIssuingCredential] = useState(false);
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

  // ===== GET QUERY PARAMS =====
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const state = params.get("state");

  useEffect(() => {
    if (!code) {
      setError(tr("faydacallback.error.missingCode"));
      return;
    }

    if (hasHandledCallback.current) {
      return;
    }
    hasHandledCallback.current = true;

    void handleCallback(code, state || undefined);
  }, [code, state]);

  const decodeUserInfoResponse = async (userinfoJwtToken: string) => {
    console.log(
      "Decoding user info JWT token:",
      userinfoJwtToken,
      " trying to decode with jose library..."
    );
    try {
      const decoded = jose.decodeJwt(userinfoJwtToken);
      return decoded;
    } catch (error) {
      console.error("Error decoding JWT user info:", error);
      return null;
    }
  };

  // ===== MAIN FLOW =====
  const handleCallback = async (authCode: string, returnedState?: string) => {
    try {
      setStatus(tr("faydacallback.status.validating"));

      const storedState = sessionStorage.getItem(SESSION_KEYS.state);

      if (storedState && returnedState && storedState !== returnedState) {
        throw new Error(tr("faydacallback.error.stateMismatch"));
      }

      const verifier = sessionStorage.getItem(SESSION_KEYS.verifier);

      setStatus(tr("faydacallback.status.exchanging"));

      // ===== TOKEN CALL =====
      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: authCode,
        }),
      });

      if (!tokenRes.ok) {
        throw new Error(tr("faydacallback.error.tokenExchangeFailed"));
      }

      const tokenJson = await tokenRes.json();
      const accessToken = tokenJson.access_token;

      if (!accessToken) {
        throw new Error(tr("faydacallback.error.noAccessToken"));
      }

      setStatus(tr("faydacallback.status.fetching"));

      // ===== USER INFO CALL =====
      const userRes = await fetch(USERINFO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });

      if (!userRes.ok) {
        throw new Error(tr("faydacallback.error.userinfoFailed"));
      }

      const userInfoResponse = await userRes.json();
      const decodedUserInfo: FaydaProfile = (await decodeUserInfoResponse(
        userInfoResponse
      )) as FaydaProfile;
      console.log("Decoded user info:", decodedUserInfo);
      // const userData: FaydaProfile = await userRes.json();

      // Show fetched user info to the user and wait for confirmation
      setUserInfo(decodedUserInfo);
      setStatus(tr("faydacallback.status.review"));

      // Keep session keys until user confirms; do not auto-redirect.
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(err.message || tr("faydacallback.status.loginFailed"));
      setStatus(tr("faydacallback.status.loginFailed"));
    }
  };

  const confirmAndContinue = async () => {
    if (!userInfo) {
      return;
    }

    const holderAid = (sessionStorage.getItem("fayda_holder_aid") || "").trim();
    let pendingIssuerAid = "";
    try {
      pendingIssuerAid = String(
        window.localStorage.getItem(FAYDA_PENDING_CONNECTION_ID_STORAGE_KEY) ||
          ""
      ).trim();
    } catch {
      pendingIssuerAid = "";
    }

    if (!holderAid) {
      setError(tr("faydacallback.error.noConnection"));
      return;
    }

    try {
      setIssuingCredential(true);
      setError(null);
      setStatus(tr("faydacallback.status.issuing"));
      const existingNotificationIds = new Set(
        (
          await Agent.agent.keriaNotifications
            .getNotifications()
            .catch(() => [])
        ).map((notification) => notification.id)
      );

      // Avoid sending large base64 blobs (for example `picture`) to issuer API.
      const { picture: _ignoredPicture, ...faydaDataForCredential } =
        userInfo as FaydaProfile & Record<string, unknown>;
      const normalizedFaydaData = {
        ...faydaDataForCredential,
        id:
          String(
            faydaDataForCredential.id ||
              faydaDataForCredential.fayda_id ||
              faydaDataForCredential.sub ||
              ""
          ).trim() || undefined,
      };

      const issueResponse = await fetch(SAVE_FAYDA_DATA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aid: holderAid,
          issuerAid: pendingIssuerAid || undefined,
          credentialName: "FaydaVerifiedAutoIssue",
          faydaData: normalizedFaydaData,
        }),
      });

      let issuePayload: any = null;
      try {
        issuePayload = await issueResponse.json();
      } catch {
        issuePayload = null;
      }

      if (!issueResponse.ok) {
        let backendMessage = tr("faydacallback.error.issuanceFailed");
        const backendBody = issuePayload;
        if (backendBody?.data) {
          backendMessage =
            typeof backendBody.data === "string"
              ? backendBody.data
              : JSON.stringify(backendBody.data);
        }
        throw new Error(backendMessage);
      }

      const issueData = issuePayload?.data || {};
      const hasIssuedCredential = Boolean(
        issueData?.autoIssued || issueData?.alreadyIssued || issueData?.credentialId
      );
      const canFinalizeConnection = Boolean(issueData?.verified);
      const backendMessage = String(issueData?.message || "").trim();
      let grantNotificationVisible = !hasIssuedCredential;

      if (hasIssuedCredential) {
        setStatus(tr("faydacallback.status.waiting"));
        grantNotificationVisible = await waitForGrantNotification(
          pendingIssuerAid,
          existingNotificationIds
        );
      }

      setUserInfo(null);
      dispatch(setFaydaVerified(canFinalizeConnection));
      setCompletionDestination(hasIssuedCredential ? "notifications" : "menu");
      setShowIssuedModal(hasIssuedCredential && grantNotificationVisible);
      setStatus(
        grantNotificationVisible
          ? backendMessage ||
              (hasIssuedCredential
                ? tr("faydacallback.status.offerSent")
                : issueData?.pendingManualReview
                  ? tr("faydacallback.status.manualReview")
                  : tr("faydacallback.status.noAutoIssue"))
          : tr("faydacallback.status.syncPending")
      );

      try {
        window.localStorage.removeItem("fayda_pending_connection_label");
      } catch {
        // no-op
      }
      sessionStorage.removeItem(SESSION_KEYS.state);
      sessionStorage.removeItem(SESSION_KEYS.verifier);
    } catch (err: any) {
      dispatch(setFaydaVerified(false));
      setError(err.message || tr("faydacallback.error.unableToIssue"));
    } finally {
      setIssuingCredential(false);
    }
  };

  const cancel = () => {
    sessionStorage.removeItem(SESSION_KEYS.state);
    sessionStorage.removeItem(SESSION_KEYS.verifier);
    history.replace("/tabs/menu");
  };

  return (
    <IonPage className="fayda-callback-page">
      <IonContent
        fullscreen
        className="fayda-callback-content"
      >
        <div className="fayda-callback-shell">
        {!error && !userInfo && (
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
              {completionDestination === "notifications" && (
                <IonButton
                  expand="block"
                  className="fayda-callback-button fayda-callback-button--primary"
                  onClick={() => history.replace("/tabs/notifications")}
                >
                  {tr("faydacallback.actions.openNotifications")}
                </IonButton>
              )}

              {completionDestination && (
                <IonButton
                  expand="block"
                  fill="outline"
                  className="fayda-callback-button fayda-callback-button--secondary"
                  onClick={() => history.replace("/tabs/menu")}
                >
                  {tr("faydacallback.actions.backToMenu")}
                </IonButton>
              )}
            </div>
          </section>
        )}

        {userInfo && (
          <section className="fayda-callback-panel fayda-callback-panel--review">
            <div className="fayda-callback-review-header">
              <div className="fayda-callback-panel-badge">
                <IonIcon icon={personCircleOutline} />
              </div>
              <h3 className="fayda-callback-review-title">
                {tr("faydacallback.review.title")}
              </h3>
              <p className="fayda-callback-review-copy">{status}</p>
            </div>

            <div className="fayda-callback-review-card">
              {userInfo.picture && (
                <div className="fayda-callback-review-image-wrap">
                  <img
                    src={userInfo.picture}
                    alt="User"
                    className="fayda-callback-review-image"
                  />
                </div>
              )}

              <ul className="fayda-callback-review-list">
                <li className="fayda-callback-review-item">
                  <strong>{tr("faydacallback.review.name")}</strong>
                  <span>{userInfo.name || tr("faydacallback.review.na")}</span>
                </li>
                <li className="fayda-callback-review-item">
                  <strong>{tr("faydacallback.review.email")}</strong>
                  <span>{userInfo.email || tr("faydacallback.review.na")}</span>
                </li>
                <li className="fayda-callback-review-item">
                  <strong>{tr("faydacallback.review.phone")}</strong>
                  <span>
                    {userInfo.phone_number || tr("faydacallback.review.na")}
                  </span>
                </li>
                {userInfo.birthdate && (
                  <li className="fayda-callback-review-item">
                    <strong>{tr("faydacallback.review.dob")}</strong>
                    <span>{userInfo.birthdate}</span>
                  </li>
                )}
              </ul>
            </div>

            <div className="fayda-callback-actions fayda-callback-actions--review">
              <IonButton
                expand="block"
                color="primary"
                className="fayda-callback-button fayda-callback-button--primary"
                disabled={issuingCredential}
                onClick={confirmAndContinue}
              >
                {issuingCredential
                  ? tr("faydacallback.actions.issuing")
                  : tr("faydacallback.actions.acceptContinue")}
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                className="fayda-callback-button fayda-callback-button--secondary"
                disabled={issuingCredential}
                onClick={cancel}
              >
                {tr("faydacallback.actions.cancel")}
              </IonButton>
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
                {tr("faydacallback.actions.backToConnections")}
              </IonButton>
            </div>
          </section>
        )}
        </div>

        <IonAlert
          isOpen={showIssuedModal}
          header={tr("faydacallback.alert.header")}
          message={tr("faydacallback.alert.message")}
          buttons={[
            {
              text: tr("faydacallback.alert.checkNotifications"),
              handler: () => history.replace("/tabs/notifications"),
            },
            {
              text: tr("faydacallback.alert.later"),
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
