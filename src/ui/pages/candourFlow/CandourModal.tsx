import { useEffect, useState } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { IonButton, IonIcon, IonText } from "@ionic/react";
import { cardOutline } from "ionicons/icons";
import { i18n } from "../../../i18n";
import { PageHeader } from "../../components/PageHeader";
import { ResponsiveModal } from "../../components/layout/ResponsiveModal";
import {
  CANDOUR_SESSION_ID_STORAGE_KEY,
  IDENTITY_PENDING_CONNECTION_LABEL_STORAGE_KEY,
  getIdentityVerificationApiBase,
  getIdentityVerificationRedirectUri,
} from "../../utils/identityVerification";
import { FaydaModalProps } from "../faydaFlow/faydaModal.types";
import "../faydaFlow/faydaModal.scss";

const CANDOUR_ISSUER_API_BASE = getIdentityVerificationApiBase("candour");

function openPendingWebBrowserWindow(): Window | null {
  if (Capacitor.isNativePlatform() || typeof window.open !== "function") {
    return null;
  }

  const browserWindow = window.open("", "_blank");
  if (!browserWindow) {
    return null;
  }

  try {
    browserWindow.opener = null;
  } catch {
    // no-op
  }

  browserWindow.document.title = "Opening Candour...";
  browserWindow.document.body.innerHTML =
    '<p style="font-family: sans-serif; padding: 24px;">Opening Candour verification...</p>';

  return browserWindow;
}

function closePendingWebBrowserWindow(browserWindow: Window | null): void {
  if (!browserWindow || browserWindow.closed) {
    return;
  }

  browserWindow.close();
}

async function openCandourBrowser(
  redirectUrl: string,
  browserWindow: Window | null
): Promise<void> {
  if (browserWindow && !browserWindow.closed) {
    browserWindow.location.replace(redirectUrl);
    return;
  }

  if (Capacitor.isNativePlatform()) {
    await Browser.open({
      url: redirectUrl,
      presentationStyle: "fullscreen",
    });
    return;
  }

  window.location.assign(redirectUrl);
}

const CandourModal = ({ isOpen, setIsOpen }: FaydaModalProps) => {
  const componentId = "share-connection-modal";
  const [verificationInProgress, setVerificationInProgress] = useState(false);
  const [connectionLabel, setConnectionLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const listener = Browser.addListener("browserFinished", () => {
      setVerificationInProgress(false);
    });

    return () => {
      listener.then((browserListener) => browserListener.remove());
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setVerificationInProgress(false);
      setErrorMessage("");
      return;
    }

    try {
      setErrorMessage("");
      setConnectionLabel(
        window.localStorage.getItem(
          IDENTITY_PENDING_CONNECTION_LABEL_STORAGE_KEY
        ) || ""
      );
    } catch {
      setConnectionLabel("");
    }
  }, [isOpen]);

  const closeModal = () => {
    setVerificationInProgress(false);
    setErrorMessage("");
    setIsOpen(false);
  };

  const openCandour = async () => {
    const pendingBrowserWindow = openPendingWebBrowserWindow();

    try {
      setVerificationInProgress(true);
      setErrorMessage("");
      const response = await fetch(
        `${CANDOUR_ISSUER_API_BASE}/candour/session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            callbackUrl: getIdentityVerificationRedirectUri("candour"),
          }),
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          String(
            payload?.data ||
              payload?.message ||
              "Unable to start Candour verification"
          )
        );
      }

      const redirectUrl = String(payload?.data?.redirectUrl || "").trim();
      const verificationSessionId = String(
        payload?.data?.verificationSessionId || ""
      ).trim();
      if (!redirectUrl || !verificationSessionId) {
        throw new Error("Candour session did not return a redirectUrl.");
      }

      sessionStorage.setItem(
        CANDOUR_SESSION_ID_STORAGE_KEY,
        verificationSessionId
      );

      await openCandourBrowser(redirectUrl, pendingBrowserWindow);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start Candour verification";

      closePendingWebBrowserWindow(pendingBrowserWindow);

      // eslint-disable-next-line no-console
      console.error("Unable to start Candour verification", error);
      setErrorMessage(message);
      setVerificationInProgress(false);
    }
  };

  return (
    <ResponsiveModal
      modalIsOpen={isOpen}
      componentId={componentId}
      customClasses={componentId}
      onDismiss={closeModal}
    >
      <PageHeader
        closeButton={true}
        closeButtonLabel={`${i18n.t("shareidentifier.done")}`}
        closeButtonAction={closeModal}
        title="Verify with Candour"
      />
      <p style={{ padding: "0 16px" }}>
        Your new connection will remain pending until Candour verification is
        completed.
        {connectionLabel ? ` Connection: ${connectionLabel}.` : ""}
      </p>

      <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
        <IonButton
          style={{ width: "100%" }}
          expand="block"
          fill="solid"
          shape={undefined}
          color="primary"
          disabled={verificationInProgress}
          onClick={() => void openCandour()}
        >
          <IonIcon
            slot="start"
            icon={cardOutline}
            style={{ padding: "0 8px" }}
          />
          {verificationInProgress
            ? "Opening Candour..."
            : "Verify with Candour"}
        </IonButton>
      </div>

      {errorMessage && (
        <IonText
          color="danger"
          style={{ display: "block", padding: "0 16px 16px" }}
        >
          <p>{errorMessage}</p>
        </IonText>
      )}
    </ResponsiveModal>
  );
};

export { CandourModal };
