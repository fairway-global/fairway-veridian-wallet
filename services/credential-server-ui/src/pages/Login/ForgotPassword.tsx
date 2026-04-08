import {
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const buttonContent = useMemo(
    () =>
      submitting ? (
        <>
          <CircularProgress size={18} color="inherit" />
          <span>Sending link</span>
        </>
      ) : (
        "Send reset link"
      ),
    [submitting]
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      triggerToast("Email is required", "error");
      return;
    }

    try {
      setSubmitting(true);
      const response = await AuthService.requestPasswordReset({
        email: email.trim(),
      });
      triggerToast(
        response.message ||
          (response.status === "sent"
            ? "Password reset email sent."
            : "No account matched that email."),
        response.status === "sent" ? "success" : "error"
      );
    } catch (error) {
      triggerToast(
        getErrorMessage(error, "Unable to send password reset email"),
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email address and we will send you a secure reset link."
      footer={
        <>
          Remembered your password?{" "}
          <Link to={RoutePath.Login} className="auth-inline-link">
            Back to sign in
          </Link>
        </>
      }
    >
      <form className="login-form" onSubmit={onSubmit}>
        <TextField
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          aria-label="Enter your email"
          type="email"
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
        Use the email for your Fairwallet account. The reset link can be
        used once and expires automatically.
      </Typography>
    </AuthShell>
  );
};

export { ForgotPassword };
