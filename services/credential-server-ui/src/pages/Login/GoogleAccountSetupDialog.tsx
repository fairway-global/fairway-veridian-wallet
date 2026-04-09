import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";

interface GoogleAccountSetupDialogProps {
  open: boolean;
  organizationName: string;
  loading: boolean;
  onOrganizationNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const GoogleAccountSetupDialog = ({
  open,
  organizationName,
  loading,
  onOrganizationNameChange,
  onClose,
  onSubmit,
}: GoogleAccountSetupDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        className: "google-account-dialog",
      }}
    >
      <DialogTitle>Finish setting up your verifier access</DialogTitle>
      <DialogContent>
        <Box className="google-account-dialog__content">
          <Typography className="google-account-dialog__copy">
            No Fairwallet dashboard account exists for this Google email yet.
            Add the remaining workspace detail below and we&apos;ll create a
            verifier account linked to your Google sign-in.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Organization or team name"
            placeholder="Optional"
            value={organizationName}
            onChange={(event) => onOrganizationNameChange(event.target.value)}
            helperText="Optional. If left blank, we will create a personal verifier workspace for you."
            disabled={loading}
          />
        </Box>
      </DialogContent>
      <DialogActions className="google-account-dialog__actions">
        <Button onClick={onClose} disabled={loading}>
          Back
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <CircularProgress size={18} color="inherit" />
              <span>Create account</span>
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { GoogleAccountSetupDialog };
