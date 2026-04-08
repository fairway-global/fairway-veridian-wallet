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
  IssuerApplicationRequest,
  IssuerApplicationStatus,
} from "../../services";
import { triggerToast } from "../../utils/toast";

const statusOptions: Array<{
  label: string;
  value: ChangeRequestStatus | IssuerApplicationStatus | "all";
}> = [
  { label: "all", value: "all" },
  { label: "pending", value: "pending" },
  { label: "approved", value: "approved" },
  { label: "rejected", value: "rejected" },
];

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "error" in error.response.data &&
    typeof error.response.data.error === "string"
  ) {
    return error.response.data.error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const AdminRequests = () => {
  const [requests, setRequests] = useState<AccountChangeRequest[]>([]);
  const [issuerApplications, setIssuerApplications] = useState<
    IssuerApplicationRequest[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    ChangeRequestStatus | IssuerApplicationStatus | "all"
  >("pending");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const status = statusFilter === "all" ? undefined : statusFilter;
      const [changeRequests, applicationRequests] = await Promise.all([
        AdminService.listRequests(status as ChangeRequestStatus | undefined),
        AdminService.listIssuerApplications(
          status as IssuerApplicationStatus | undefined
        ),
      ]);
      setRequests(changeRequests);
      setIssuerApplications(applicationRequests);
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
    } catch (error) {
      triggerToast(getErrorMessage(error, "Unable to review request"), "error");
    }
  };

  const reviewIssuerApplication = async (
    requestId: string,
    status: "approved" | "rejected"
  ) => {
    try {
      await AdminService.reviewIssuerApplication(requestId, { status });
      triggerToast(`Issuer request ${status}`, "success");
      await fetchRequests();
    } catch (error) {
      triggerToast(
        getErrorMessage(error, "Unable to review issuer request"),
        "error"
      );
    }
  };

  return (
    <Box
      sx={{
        padding: { xs: 1.25, sm: 3 },
        display: "grid",
        gap: 2,
      }}
    >
      <Typography variant="h4">Access requests</Typography>

      <Paper sx={{ padding: 2, display: "grid", gap: 2 }}>
        <Box sx={{ width: { xs: "100%", sm: 200 } }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | ChangeRequestStatus
                  | IssuerApplicationStatus
                  | "all"
              )
            }
          >
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography variant="h6">Issuer access requests</Typography>
          <Typography variant="body2" color="text.secondary">
            Review public issuer applications and create the managed issuer
            access when approved.
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 1080 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Use case</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Provisioned</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {issuerApplications.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Box sx={{ display: "grid", gap: 0.25 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {request.organizationName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.website || "-"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "grid", gap: 0.25 }}>
                        <Typography variant="body2">{request.contactName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.phoneNumber || "-"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{request.email}</TableCell>
                    <TableCell>{request.organizationType || "-"}</TableCell>
                    <TableCell>{request.country || "-"}</TableCell>
                    <TableCell>{request.credentialUseCase}</TableCell>
                    <TableCell>{request.status}</TableCell>
                    <TableCell>{request.provisionedUserEmail || "-"}</TableCell>
                    <TableCell>
                      {request.status === "pending" ? (
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <Button
                            variant="outlined"
                            size="small"
                            color="success"
                            onClick={() => {
                              void reviewIssuerApplication(request.id, "approved");
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            onClick={() => {
                              void reviewIssuerApplication(request.id, "rejected");
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
                {!issuerApplications.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No issuer applications found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Box>

        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography variant="h6">Profile change requests</Typography>
          <Typography variant="body2" color="text.secondary">
            Review profile changes submitted by existing issuer and verifier
            accounts.
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 920 }}>
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
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            flexWrap: "wrap",
                          }}
                        >
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
                    <TableCell colSpan={8} align="center">
                      No profile change requests found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export { AdminRequests };
