import { RequestType } from "../../../../globals/types";

interface ConnectionsOptionModalProps {
  type: RequestType;
  connectModalIsOpen: boolean;
  setConnectModalIsOpen: (value: boolean) => void;
  handleScanConnection: () => Promise<void> | void;
  handleProvideQr: () => Promise<void> | void;
}

export type { ConnectionsOptionModalProps };
