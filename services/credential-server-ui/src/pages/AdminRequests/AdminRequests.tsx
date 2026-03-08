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
  AdminService,
  ChangeRequestStatus,
} from "../../services";
import { triggerToast } from "../../utils/toast";

const statusOptions: Array<{
  label: string;
  value: ChangeRequestStatus | "all";
}> = [
  { label: "all", value: "all" },
  { label: "pending", value: "pending" },
  { label: "approved", value: "approved" },
  { label: "rejected", value: "rejected" },
];

const AdminRequests = () => {
  const [requests, setRequests] = useState<AccountChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ChangeRequestStatus | "all">(
    "pending"
  );

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const result = await AdminService.listRequests(
        statusFilter === "all" ? undefined : statusFilter
      );
      setRequests(result);
    } catch {
      triggerToast("Unable to load requests", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRequests();
  }, [statusFilter]);

  const reviewRequest = async (
    requestId: string,
    status: "approved" | "rejected"
  ) => {
    try {
      await AdminService.reviewRequest(requestId, { status });
      triggerToast(`Request ${status}`, "success");
      await fetchRequests();
    } catch {
      triggerToast("Unable to review request", "error");
    }
  };

  return (
    <Box sx={{ padding: 3, display: "grid", gap: 2 }}>
      <Typography variant="h4">User Requests</Typography>

      <Paper sx={{ padding: 2, display: "grid", gap: 2 }}>
        <Box sx={{ width: 200 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ChangeRequestStatus | "all")
            }
          >
            {statusOptions.map((option) => (
              <MenuItem
                key={option.value}
                value={option.value}
              >
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Field</TableCell>
              <TableCell>Current</TableCell>
              <TableCell>Requested</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>{request.userEmail || "-"}</TableCell>
                <TableCell>{request.userRole || "-"}</TableCell>
                <TableCell>{request.fieldName}</TableCell>
                <TableCell>{request.currentValue}</TableCell>
                <TableCell>{request.requestedValue}</TableCell>
                <TableCell>{request.reason || "-"}</TableCell>
                <TableCell>{request.status}</TableCell>
                <TableCell>
                  {request.status === "pending" ? (
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        color="success"
                        onClick={() => {
                          void reviewRequest(request.id, "approved");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={() => {
                          void reviewRequest(request.id, "rejected");
                        }}
                      >
                        Reject
                      </Button>
                    </Box>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!requests.length && !loading && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  align="center"
                >
                  No requests found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export { AdminRequests };
