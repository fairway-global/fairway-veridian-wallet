import { useEffect, useRef, useState } from "react";
import { useAppDispatch } from "../../../store/hooks";
import { setFaydaVerified } from "../../../store/reducers/faydaVerifiedCache";
import { useLocation, useHistory } from "react-router-dom";
import {
  IonAlert,
  IonPage,
  IonContent,
  IonSpinner,
  IonText,
  IonButton,
} from "@ionic/react";
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

  const [status, setStatus] = useState("Processing Fayda login...");
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<FaydaProfile | null>(null);
  const [issuingCredential, setIssuingCredential] = useState(false);
  const [showIssuedModal, setShowIssuedModal] = useState(false);

  // ===== GET QUERY PARAMS =====
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const state = params.get("state");

  useEffect(() => {
    if (!code) {
      setError("Missing authorization code");
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
      setStatus("Validating session...");

      const storedState = sessionStorage.getItem(SESSION_KEYS.state);

      if (storedState && returnedState && storedState !== returnedState) {
        throw new Error("State mismatch. Restart login.");
      }

      const verifier = sessionStorage.getItem(SESSION_KEYS.verifier);

      setStatus("Exchanging code for token...");

      // ===== TOKEN CALL =====
      const tokenRes = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: authCode,
        }),
      });

      if (!tokenRes.ok) throw new Error("Token exchange failed");

      const tokenJson = await tokenRes.json();
      const accessToken = tokenJson.access_token;

      if (!accessToken) throw new Error("No access token returned");

      setStatus("Fetching verified identity...");

      // ===== USER INFO CALL =====
      const userRes = await fetch(USERINFO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });

      if (!userRes.ok) throw new Error("Userinfo failed");

      const userInfoResponse = await userRes.json();
      const decodedUserInfo: FaydaProfile = (await decodeUserInfoResponse(
        userInfoResponse
      )) as FaydaProfile;
      console.log("Decoded user info:", decodedUserInfo);
      // const userData: FaydaProfile = await userRes.json();

      // Show fetched user info to the user and wait for confirmation
      setUserInfo(decodedUserInfo);
      setStatus(
        "Review the received user information, then accept and continue."
      );

      // Keep session keys until user confirms; do not auto-redirect.
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(err.message || "Callback failed");
      setStatus("Login failed");
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
      setError(
        "No connection found for credential issuance. Create/scan the connection first, then verify with Fayda."
      );
      return;
    }

    try {
      setIssuingCredential(true);
      setError(null);
      setStatus("Issuing FaydaVerifiedAutoIssue...");

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
        let backendMessage = "Credential issuance failed";
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

      dispatch(setFaydaVerified(canFinalizeConnection));
      setShowIssuedModal(hasIssuedCredential);
      setStatus(
        hasIssuedCredential
          ? "Credential offer was sent to your wallet."
          : "Fayda verification completed. No auto-issued credential is configured for this issuer."
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
      setError(err.message || "Unable to issue credential");
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
    <IonPage>
      <IonContent className="ion-padding">
        {!error && !userInfo && (
          <>
            <IonSpinner />
            <IonText>
              <p>{status}</p>
            </IonText>
          </>
        )}

        {userInfo && (
          <div className="fayda-callback-review">
            <div className="fayda-callback-review-card">
              <h3 className="fayda-callback-review-title">User Information</h3>
              <ul className="fayda-callback-review-list">
                <li className="fayda-callback-review-item">
                  <strong>Name:</strong> {userInfo.name || "N/A"}
                </li>
                <li className="fayda-callback-review-item">
                  <strong>Email:</strong> {userInfo.email || "N/A"}
                </li>
                <li className="fayda-callback-review-item">
                  <strong>Phone:</strong> {userInfo.phone_number || "N/A"}
                </li>
                {userInfo.birthdate && (
                  <li className="fayda-callback-review-item">
                    <strong>Date Of Birth:</strong> {userInfo.birthdate}
                  </li>
                )}
                {userInfo.picture && (
                  <li className="fayda-callback-review-image-wrap">
                    <img
                      src={userInfo.picture}
                      alt="User"
                      className="fayda-callback-review-image"
                    />
                  </li>
                )}
              </ul>

              <div className="fayda-callback-review-actions">
                <IonButton
                  color="primary"
                  disabled={issuingCredential}
                  onClick={confirmAndContinue}
                >
                  {issuingCredential
                    ? "Issuing credential..."
                    : "Accept and continue"}
                </IonButton>
                <IonButton
                  fill="outline"
                  disabled={issuingCredential}
                  onClick={cancel}
                >
                  Cancel
                </IonButton>
              </div>
            </div>
          </div>
        )}

        {error && (
          <>
            <IonText color="danger">
              <p>{error}</p>
            </IonText>

            <IonButton
              expand="block"
              onClick={() => history.replace("/tabs/menu")}
            >
              Back to Connections
            </IonButton>
          </>
        )}

        <IonAlert
          isOpen={showIssuedModal}
          header="FaydaVerifiedAutoIssue issued"
          message="Credential offer sent. Open Notifications and accept the credential."
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
