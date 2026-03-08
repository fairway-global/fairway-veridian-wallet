import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { RoleIndex } from "../../components/NavBar/constants/roles";
import { RoutePath } from "../../const/route";
import { AuthService } from "../../services/auth";
import { useAppDispatch } from "../../store/hooks";
import { setSession } from "../../store/reducers/authSlice";
import { setRoleView } from "../../store/reducers/stateCache";
import { triggerToast } from "../../utils/toast";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      triggerToast("Email and password are required", "error");
      return;
    }

    try {
      setLoading(true);
      const session = await AuthService.login({
        email: email.trim(),
        password,
      });

      dispatch(
        setSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user: session.user,
        })
      );
      if (session.user.role === "admin") {
        navigate(RoutePath.AdminUsers);
      } else {
        dispatch(
          setRoleView(
            session.user.role === "verifier"
              ? RoleIndex.VERIFIER
              : RoleIndex.ISSUER
          )
        );
        navigate(RoutePath.Connections);
      }
    } catch {
      triggerToast("Invalid email or password", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(135deg, rgba(236,245,253,1) 0%, rgba(244,248,237,1) 100%)",
        padding: 2,
      }}
    >
      <Paper
        sx={{
          width: "100%",
          maxWidth: 420,
          padding: 3,
          display: "grid",
          gap: 2,
        }}
      >
        <Typography
          variant="h5"
          fontWeight={600}
        >
          {location.pathname === RoutePath.AdminLogin
            ? "Admin Login"
            : "Dashboard Login"}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
        >
          Sign in with your email and password. Dashboard access is assigned by admin.
        </Typography>

        <Box
          component="form"
          onSubmit={onSubmit}
          sx={{ display: "grid", gap: 2 }}
        >
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            size="small"
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            size="small"
            required
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export { Login };
