import { useEffect, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { IonPage, IonContent, IonSpinner, IonText, IonButton } from "@ionic/react";

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
  phone?: string;
  picture?: string;
  fan?: string;
};

// eslint-disable-next-line no-console
console.log("Api base url:", API_BASE);

export const FaydaCallback = () => {
  const location = useLocation();
  const history = useHistory();

  const [status, setStatus] = useState("Processing Fayda login...");
  const [error, setError] = useState<string | null>(null);

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

      const userData: FaydaProfile = await userRes.json();

      setStatus("Saving session...");

      // ===== STORE SESSION =====
      localStorage.setItem("fayda_session", "true");

      if (userData?.fan)
        localStorage.setItem("fayda_fan", userData.fan);

      if (userData?.name)
        localStorage.setItem("fayda_name", userData.name);

      if (userData?.picture)
        localStorage.setItem("fayda_picture", userData.picture);

      // ===== CLEANUP =====
      sessionStorage.removeItem(SESSION_KEYS.state);
      sessionStorage.removeItem(SESSION_KEYS.verifier);

      setStatus("Login successful — redirecting...");

      setTimeout(() => {
        history.replace("/tabs/menu");
      }, 800);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(err.message || "Callback failed");
      setStatus("Login failed");
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        {!error && (
          <>
            <IonSpinner />
            <IonText>
              <p>{status}</p>
            </IonText>
          </>
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
