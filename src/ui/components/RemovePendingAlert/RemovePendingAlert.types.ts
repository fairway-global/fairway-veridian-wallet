interface PopupProps {
  title: string;
  description: string;
  button: string;
}

interface RemovePendingAlertProps {
  pageId: string;
  openFirstCheck: boolean;
  onClose: () => void;
  firstCheckProps: PopupProps;
  secondCheckTitle: string;
  onDeletePendingItem: () => void;
  finishConnectingButtonText?: string;
  onFinishConnecting?: () => void;
}

export type { RemovePendingAlertProps };
