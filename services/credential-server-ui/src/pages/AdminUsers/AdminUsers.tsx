import {
  Backdrop,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { AdminService, ManagedRole, ManagedUser } from "../../services";
import { triggerToast } from "../../utils/toast";

const AdminUsers = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ManagedRole>("issuer");
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const result = await AdminService.listUsers();
      setUsers(result);
    } catch {
      triggerToast("Unable to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const createUser = async () => {
    if (!email.trim() || !password.trim()) {
      triggerToast("Email and password are required", "error");
      return;
    }

    try {
      setCreating(true);
      await AdminService.createUser({
        email: email.trim(),
        password: password.trim(),
        role,
        displayName: displayName.trim() || undefined,
      });
      setEmail("");
      setPassword("");
      setRole("issuer");
      setDisplayName("");
      triggerToast("User created", "success");
      await fetchUsers();
    } catch {
      triggerToast("Unable to create user", "error");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (user: ManagedUser) => {
    try {
      await AdminService.updateUserStatus(user.id, !user.isActive);
      await fetchUsers();
    } catch {
      triggerToast("Unable to update user", "error");
    }
  };

  return (
    <Box sx={{ padding: 3, display: "grid", gap: 2 }}>
      <Typography variant="h4">Admin Dashboard</Typography>

      <Paper sx={{ padding: 2, display: "grid", gap: 2 }}>
        <Typography variant="h6">Create Issuer / Verifier Login</Typography>
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "2fr 2fr 1fr 2fr auto" }}>
          <TextField
            size="small"
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={creating}
          />
          <TextField
            size="small"
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={creating}
          />
          <TextField
            select
            size="small"
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value as ManagedRole)}
            disabled={creating}
          >
            <MenuItem value="issuer">issuer</MenuItem>
            <MenuItem value="verifier">verifier</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={creating}
          />
          <Button
            variant="contained"
            onClick={createUser}
            disabled={creating}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ padding: 2, display: "grid", gap: 1 }}>
        <Typography variant="h6">Managed Accounts</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Issuer Code</TableCell>
              <TableCell>Issuer Name</TableCell>
              <TableCell>Keria AID</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>{user.issuerCode}</TableCell>
                <TableCell>{user.issuerName}</TableCell>
                <TableCell>{user.aidPrefix || "-"}</TableCell>
                <TableCell>
                  <Switch
                    checked={user.isActive}
                    onChange={() => {
                      void toggleStatus(user);
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!users.length && !loading && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  align="center"
                >
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <Backdrop
        open={creating}
        sx={(theme) => ({ color: "#fff", zIndex: theme.zIndex.drawer + 1 })}
      >
        <Box sx={{ display: "grid", gap: 1, justifyItems: "center" }}>
          <CircularProgress color="inherit" />
          <Typography>Creating user account...</Typography>
        </Box>
      </Backdrop>
    </Box>
  );
};

export { AdminUsers };
