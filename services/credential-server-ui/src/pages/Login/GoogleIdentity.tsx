import { Box } from "@mui/material";

export interface GoogleCredentialResponse {
  credential?: string;
}

export interface GooglePromptMomentNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
}

export interface GoogleAccountsIdApi {
  initialize: (input: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  prompt: (
    listener?: (notification: GooglePromptMomentNotification) => void
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsIdApi;
      };
    };
  }
}

const GoogleMark = () => (
  <Box className="google-mark" aria-hidden="true">
    <span className="google-mark__g">G</span>
  </Box>
);

export { GoogleMark };
