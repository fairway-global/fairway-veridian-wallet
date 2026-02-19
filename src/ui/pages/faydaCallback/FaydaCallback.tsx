import { useEffect, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { IonPage, IonContent, IonSpinner, IonText, IonButton } from "@ionic/react";
import * as jose from 'jose';
import { de } from "@faker-js/faker";

// ===== CONFIG =====
const API_BASE =
  process.env.REACT_APP_BACKEND_API || "http://localhost:3001";


const TOKEN_ENDPOINT = `${API_BASE}/token`;
const USERINFO_ENDPOINT = `${API_BASE}/userinfo`;

const SESSION_KEYS = {
  state: "fayda_state",
  verifier: "fayda_pkce_verifier",
};

type FaydaProfile = {
  name?: string;
  email?: string;
  phone_number?: string;
  picture?: string;
  birthdate?: string;
};

// eslint-disable-next-line no-console


export const FaydaCallback = () => {
  const location = useLocation();
  const history = useHistory();

  const [status, setStatus] = useState("Processing Fayda login...");
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<FaydaProfile | null>(null);

  // ===== GET QUERY PARAMS =====
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const state = params.get("state");

  useEffect(() => {
    if (!code) {
      setError("Missing authorization code");
      return;
    }

    handleCallback(code, state || undefined);
  }, [code]);

  const decodeUserInfoResponse = async (userinfoJwtToken :string) => {
    console.log("Decoding user info JWT token:", userinfoJwtToken, ' trying to decode with jose library...');
    try {
      const decoded = jose.decodeJwt(userinfoJwtToken);
      return decoded;
    } catch (error) {
      console.error('Error decoding JWT user info:', error);
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
          code: authCode
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
      const decodedUserInfo : FaydaProfile = await decodeUserInfoResponse(userInfoResponse) as FaydaProfile;
      console.log("Decoded user info:", decodedUserInfo);
      // const userData: FaydaProfile = await userRes.json();

      // Show fetched user info to the user and wait for confirmation
      setUserInfo(decodedUserInfo);
      setStatus("Review the received user information and confirm.");

      // Keep session keys until user confirms; do not auto-redirect.
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(err.message || "Callback failed");
      setStatus("Login failed");
    }
  };

  const confirmAndContinue = () => {
  // save session/localStorage then redirect
  localStorage.setItem("fayda_session", "true");
  if (userInfo?.name) localStorage.setItem("fayda_name", userInfo.name);
  // cleanup
  sessionStorage.removeItem(SESSION_KEYS.state);
  sessionStorage.removeItem(SESSION_KEYS.verifier);
  history.replace("/tabs/menu");
};

const cancel = () => {
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
              <p>{String(userInfo)}</p>
            </IonText>
          </>
        )}

        {userInfo && (
          <div style={{ width: '100%', maxWidth: '900px', margin: '24px auto', textAlign: 'center' }}>
            <div
              style={{
                backgroundColor: '#162447',
                borderRadius: '15px',
                boxShadow: '0 10px 20px rgba(0, 0, 0, 0.3)',
                border: 'none',
                padding: '30px'
              }}
            >
              <h3 style={{ color: '#f8c94e', marginBottom: '12px' }}>User Information</h3>
              <ul style={{ listStyleType: 'none', padding: 0, textAlign: 'left' }}>
                <li style={{ backgroundColor: '#0f3460', borderRadius: '8px', padding: '12px', marginBottom: '8px', color: 'white' }}>
                  <strong>Name:</strong> {userInfo.name || 'N/A'}
                </li>
                <li style={{ backgroundColor: '#0f3460', borderRadius: '8px', padding: '12px', marginBottom: '8px', color: 'white' }}>
                  <strong>Email:</strong> {userInfo.email || 'N/A'}
                </li>
                <li style={{ backgroundColor: '#0f3460', borderRadius: '8px', padding: '12px', marginBottom: '8px', color: 'white' }}>
                  <strong>Phone:</strong> {userInfo.phone_number || 'N/A'}
                </li>
                {userInfo.birthdate && (
                  <li style={{ backgroundColor: '#0f3460', borderRadius: '8px', padding: '12px', marginBottom: '8px', color: 'white' }}>
                    <strong>Date Of Birth:</strong> {userInfo.birthdate}
                  </li>
                )}
                {userInfo.picture && (
                  <li style={{ textAlign: 'center', marginTop: '12px' }}>
                    <img src={userInfo.picture} alt="User" style={{ width: 140, height: 140, borderRadius: '50%', border: '3px solid rgb(193,160,77)', padding: 6 }} />
                  </li>
                )}
              </ul>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '18px' }}>
                <IonButton color="primary" onClick={confirmAndContinue}>Confirm and continue</IonButton>
                <IonButton fill="outline" onClick={cancel}>Cancel</IonButton>
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
      </IonContent>
    </IonPage>
  );
};
