import { scanCircleOutline, qrCodeOutline } from "ionicons/icons";
import { ConnectionsOptionModalProps } from "./ConnectionsOptionModal.types";
import { OptionItem, OptionModal } from "../../../../components/OptionsModal";
import { i18n } from "../../../../../i18n";

const ConnectionsOptionModal = ({
  type,
  connectModalIsOpen,
  setConnectModalIsOpen,
  handleScanConnection,
  handleProvideQr,
}: ConnectionsOptionModalProps) => {
  const translatedType = i18n.t(`connectmodal.types.${type.toLowerCase()}`, {
    defaultValue: type.toLowerCase(),
  });
  const options: OptionItem[] = [
    {
      icon: scanCircleOutline,
      label: i18n.t("connectmodal.scan"),
      onClick: () => {
        setConnectModalIsOpen(false);
        handleScanConnection();
      },
      testId: "add-connection-modal-scan-qr-code",
    },
    {
      icon: qrCodeOutline,
      label: i18n.t("connectmodal.provide"),
      onClick: () => {
        setConnectModalIsOpen(false);
        handleProvideQr();
      },
      testId: "add-connection-modal-provide-qr-code",
    },
  ];

  const handleClose = () => setConnectModalIsOpen(false);

  return (
    <OptionModal
      modalIsOpen={connectModalIsOpen}
      componentId="add-connection-modal"
      onDismiss={handleClose}
      header={{
        closeButton: true,
        closeButtonAction: handleClose,
        closeButtonLabel: `${i18n.t("connectmodal.close")}`,
        title: `${i18n.t("connectmodal.title", {
          type: translatedType,
        })}`,
      }}
      items={options}
    />
  );
};

export { ConnectionsOptionModal };
