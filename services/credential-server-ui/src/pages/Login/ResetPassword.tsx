import {
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordField } from "../../components/PasswordField";
import { RoutePath } from "../../const/route";
import { AuthService } from "../../services";
import { triggerToast } from "../../utils/toast";
import { AuthShell } from "./AuthShell";

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

const ResetPassword = () => {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const buttonContent = useMemo(
    () =>
      submitting ? (
        <>
          <CircularProgress size={18} color="inherit" />
          <span>Updating password</span>
        </>
      ) : (
        "Set new password"
      ),
    [submitting]
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      triggerToast("This reset link is missing its token", "error");
      return;
    }
    if (password.length < 8) {
      triggerToast("Password must be at least 8 characters long", "error");
      return;
    }
    if (password !== confirmPassword) {
      triggerToast("Passwords do not match", "error");
      return;
    }

    try {
      setSubmitting(true);
      await AuthService.resetPassword({ token, password });
      triggerToast("Password updated. You can sign in now.", "success");
      navigate(RoutePath.Login);
    } catch (error) {
      triggerToast(
        getErrorMessage(error, "Unable to reset password"),
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Set a new password for your Fairwallet account."
      footer={
        <>
          Need another email?{" "}
          <Link to={RoutePath.ForgotPassword} className="auth-inline-link">
            Request a new reset link
          </Link>
        </>
      }
    >
      <form className="login-form" onSubmit={onSubmit}>
        <PasswordField
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your new password"
          aria-label="Enter your new password"
          required
          fullWidth
        />
        <PasswordField
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm your new password"
          aria-label="Confirm your new password"
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          className="login-submit-button primary-button"
          disableElevation
          disabled={submitting}
        >
          {buttonContent}
        </Button>
      </form>

      <Typography className="auth-helper-copy">
        Choose a password with at least 8 characters. This reset link can only
        be used once.
      </Typography>
    </AuthShell>
  );
};

export { ResetPassword };
