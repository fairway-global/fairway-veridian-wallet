interface AddConnectionModalProps {
  openModal: boolean;
  setOpenModal: (value: boolean) => void;
  handleGetContacts: () => Promise<void> | void;
}

export type { AddConnectionModalProps };
