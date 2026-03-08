import {
  Box,
  Button,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  AccountChangeRequest,
  AccountProfile,
  AccountService,
  ChangeRequestField,
} from "../../services";
import { useAppSelector } from "../../store/hooks";
import { getCurrentUser } from "../../store/reducers/authSlice";
import { triggerToast } from "../../utils/toast";

const fieldOptions: Array<{
  value: ChangeRequestField;
  label: string;
}> = [
  { value: "issuer_name", label: "Display name" },
  { value: "email", label: "Email" },
];

const Settings = () => {
  const currentUser = useAppSelector(getCurrentUser);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [requests, setRequests] = useState<AccountChangeRequest[]>([]);
  const [fieldName, setFieldName] = useState<ChangeRequestField>("issuer_name");
  const [requestedValue, setRequestedValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const isAccountUser =
    currentUser?.role === "issuer" || currentUser?.role === "verifier";

  const fetchData = async () => {
    if (!isAccountUser) {
      return;
    }
    try {
      setLoading(true);
      const [profileData, requestData] = await Promise.all([
        AccountService.profile(),
        AccountService.listRequests(),
      ]);
      setProfile(profileData);
      setRequests(requestData);
    } catch {
      triggerToast("Unable to load account details", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [isAccountUser]);

  const submitRequest = async () => {
    if (!requestedValue.trim()) {
      triggerToast("Requested value is required", "error");
      return;
    }

    try {
      await AccountService.createRequest({
        fieldName,
        requestedValue: requestedValue.trim(),
        reason: reason.trim() || undefined,
      });
      setRequestedValue("");
      setReason("");
      triggerToast("Request submitted", "success");
      await fetchData();
    } catch {
      triggerToast("Unable to submit request", "error");
    }
  };

  if (!isAccountUser) {
    return (
      <Box sx={{ padding: 3 }}>
        <Paper sx={{ padding: 2 }}>
          <Typography variant="body1">
            Settings are available for issuer and verifier accounts.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ padding: 3, display: "grid", gap: 2 }}>
      <Typography variant="h4">Account Settings</Typography>

      <Paper sx={{ padding: 2, display: "grid", gap: 1 }}>
        <Typography variant="h6">User Information</Typography>
        {profile ? (
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>{profile.email}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Role</TableCell>
                <TableCell>{profile.role}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Issuer Code</TableCell>
                <TableCell>{profile.issuerCode}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Issuer Name</TableCell>
                <TableCell>{profile.issuerName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Keria Alias</TableCell>
                <TableCell>{profile.keria.aidAlias || "-"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Keria AID Prefix</TableCell>
                <TableCell>{profile.keria.aidPrefix || "-"}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2">
            {loading ? "Loading profile..." : "No profile data"}
          </Typography>
        )}
      </Paper>

      <Paper sx={{ padding: 2, display: "grid", gap: 2 }}>
        <Typography variant="h6">Request Detail Change</Typography>
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 2fr 2fr auto" }}>
          <TextField
            select
            size="small"
            label="Field"
            value={fieldName}
            onChange={(event) =>
              setFieldName(event.target.value as ChangeRequestField)
            }
          >
            {fieldOptions.map((option) => (
              <MenuItem
                key={option.value}
                value={option.value}
              >
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type={fieldName === "email" ? "email" : "text"}
            label="Requested value"
            value={requestedValue}
            onChange={(event) => setRequestedValue(event.target.value)}
          />
          <TextField
            size="small"
            label="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            variant="contained"
            onClick={submitRequest}
          >
            Submit
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ padding: 2 }}>
        <Typography
          variant="h6"
          sx={{ marginBottom: 1 }}
        >
          My Requests
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Field</TableCell>
              <TableCell>Current</TableCell>
              <TableCell>Requested</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>{request.fieldName}</TableCell>
                <TableCell>{request.currentValue}</TableCell>
                <TableCell>{request.requestedValue}</TableCell>
                <TableCell>{request.reason || "-"}</TableCell>
                <TableCell>{request.status}</TableCell>
              </TableRow>
            ))}
            {!requests.length && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  align="center"
                >
                  No requests yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export { Settings };
