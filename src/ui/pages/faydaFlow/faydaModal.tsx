// import { Share } from "@capacitor/share";
import { IonButton, IonIcon } from "@ionic/react";
import { Browser } from "@capacitor/browser";
import { cardOutline } from "ionicons/icons";
import { i18n } from "../../../i18n";
// import { useAppDispatch } from "../../../store/hooks";
// import { setToastMsg } from "../../../store/reducers/stateCache";
// import { ToastMsgType } from "../../globals/types";
// import { writeToClipboard } from "../../utils/clipboard";
import { PageHeader } from "../../../ui/components/PageHeader";
import { ResponsiveModal } from "../../../ui/components/layout/ResponsiveModal";
import "./faydaModal.scss";
import { FaydaModalProps } from "./faydaModal.types";
import { useEffect, useState } from "react";

// const VERIFICATION_CANCELLED_ERROR = "Verification canceled";
const FaydaModal = ({ isOpen, setIsOpen }: FaydaModalProps) => {
  const componentId = "share-connection-modal";
  //   const dispatch = useAppDispatch();

  const [verificationInProgress, setVerificationInProgress] = useState(false);

  useEffect(() => {
    const listener = Browser.addListener("browserFinished", () => {
      //eslint-disable-next-line no-console
      console.log("Browser closed by user");
      setVerificationInProgress(false);
    });
    return () => {
      listener.then((browserListener) => browserListener.remove());
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setVerificationInProgress(false);
    }
  }, [isOpen]);

  const closeModal = () => {
    setVerificationInProgress(false);
    setIsOpen(false);
  };

  const faydaUrlGenerator = () => {
    const CLIENT_ID = "crXYIYg2cJiNTaw5t-peoPzCRo-3JATNfBd5A86U8t0";
    const REDIRECT_URI =
      process.env.REACT_APP_FAYDA_REDIRECT_URI ||
      // "org.cardanofoundation.idw://fayda/callback";
      "http://localhost:3000/callback";
    const AUTH_ENDPOINT = "https://esignet.ida.fayda.et/authorize";

    if (!CLIENT_ID || !REDIRECT_URI || !AUTH_ENDPOINT) {
      // eslint-disable-next-line no-console
      console.error("Missing Fayda test env variables");
      return "";
    }

    const claims = {
      userinfo: {
        name: { essential: true },
        phone: { essential: true },
        email: { essential: true },
        picture: { essential: true },
        gender: { essential: true },
        birthdate: { essential: true },
        address: { essential: true },
      },
      id_token: {},
    };

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile email",
      acr_values:
        "mosip:idp:acr:generated-code mosip:idp:acr:linked-wallet mosip:idp:acr:biometrics",
      claims: JSON.stringify(claims),
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "S256",
      display: "page",
      nonce: "g4DEuje5Fx57Vb64dO4oqLHXGT8L8G7g",
      state: "ptOO76SD",
      ui_locales: "en",
    });

    return `${AUTH_ENDPOINT}?${params.toString()}`;
  };

  const openFayda = async () => {
    const url = faydaUrlGenerator();
    if (!url) {
      // eslint-disable-next-line no-console
      console.error("Fayda URL is invalid");
      return;
    }
    await Browser.open({
      url: url,
      presentationStyle: "fullscreen",
    });
    setVerificationInProgress(true);
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
        title={"Verify with Fayda"}
      />
      <p style={{ padding: "0 16px" }}>
        You will be redirected to Fayda to complete verification. Once
        completed, return to the app to add a connection.
      </p>

      <div
        style={{ padding: 16, display: "flex", justifyContent: "center" }}
        onClick={openFayda}
      >
        <IonButton
          style={{ width: "100%" }}
          expand="block" // prevents circular layout
          fill="solid"
          shape={undefined} // explicitly remove round
          color="primary"
          disabled={verificationInProgress}
        >
          <IonIcon
            slot="start"
            icon={cardOutline}
            style={{ padding: "0 8px" }}
          />
          {verificationInProgress ? "Verifying..." : "Verify with Fayda"}
        </IonButton>
      </div>
    </ResponsiveModal>
  );
};

export { FaydaModal };
