import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { config } from "../../config";
import { RoutePath } from "../../const/route";
import { PasswordField } from "../../components/PasswordField";
import { AuthService, AuthSessionResponse } from "../../services/auth";
import { useAppDispatch } from "../../store/hooks";
import { setSession } from "../../store/reducers/authSlice";
import { setRoleView } from "../../store/reducers/stateCache";
import { triggerToast } from "../../utils/toast";
import { RoleIndex } from "../../components/NavBar/constants/roles";
import { AuthShell } from "./AuthShell";
import {
  GoogleCredentialResponse,
  GoogleMark,
} from "./GoogleIdentity";
import "./Login.scss";

const GOOGLE_SCRIPT_ID = "fairway-google-identity-script";
const REMEMBERED_EMAIL_KEY = "credential_server_ui_remembered_email";

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

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (!config.googleClientId) {
      return;
    }

    if (window.google?.accounts?.id) {
      setGoogleReady(true);
      return;
    }

    const existingScript = document.getElementById(
      GOOGLE_SCRIPT_ID
    ) as HTMLScriptElement | null;

    const handleReady = () => setGoogleReady(true);

    if (existingScript) {
      existingScript.addEventListener("load", handleReady);
      return () => {
        existingScript.removeEventListener("load", handleReady);
      };
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleReady);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleReady);
    };
  }, []);

  const completeLogin = useCallback(
    (session: AuthSessionResponse, emailToRemember: string) => {
      if (rememberMe && emailToRemember.trim()) {
        window.localStorage.setItem(REMEMBERED_EMAIL_KEY, emailToRemember.trim());
      } else {
        window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      dispatch(
        setSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user: session.user,
        })
      );

      if (session.user.role === "admin") {
        navigate(RoutePath.AdminUsers);
        return;
      }

      dispatch(
        setRoleView(
          session.user.role === "verifier"
            ? RoleIndex.VERIFIER
            : RoleIndex.ISSUER
        )
      );
      navigate(RoutePath.Activities);
    },
    [dispatch, navigate, rememberMe]
  );

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setGoogleLoading(false);
        triggerToast("Google sign in did not return a credential", "warning");
        return;
      }

      try {
        const session = await AuthService.googleLogin({
          idToken: response.credential,
        });
        completeLogin(session, session.user.email);
      } catch (error) {
        triggerToast(
          getErrorMessage(error, "Google sign in failed"),
          "error"
        );
      } finally {
        setGoogleLoading(false);
      }
    },
    [completeLogin]
  );

  useEffect(() => {
    if (!googleReady || !config.googleClientId || !window.google?.accounts?.id) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
  }, [googleReady, handleGoogleCredential]);

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
      completeLogin(session, email.trim());
    } catch (error) {
      triggerToast(
        getErrorMessage(error, "Invalid email or password"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!config.googleClientId) {
      triggerToast(
        "Google sign in is not configured. Set GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID and restart the UI.",
        "warning"
      );
      return;
    }

    if (!window.google?.accounts?.id) {
      triggerToast("Google sign in is still loading. Please try again.", "info");
      return;
    }

    setGoogleLoading(true);
    window.google.accounts.id.prompt((notification) => {
      if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
        setGoogleLoading(false);
        triggerToast(
          "Google sign in could not open. Please try email sign in or retry.",
          "warning"
        );
      }
    });
  };

  const handleForgotPassword = () => {
    navigate(RoutePath.ForgotPassword);
  };

  const loginButtonContent = useMemo(
    () =>
      loading ? (
        <>
          <CircularProgress size={18} color="inherit" />
          <span>Signing In</span>
        </>
      ) : (
        "Sign In"
      ),
    [loading]
  );

  return (
    <AuthShell
      title="Sign in to Fairwallet"
      subtitle="Access your credential operations workspace securely."
      footer={
        <Box className="auth-access-cta">
          <Typography component="span" className="auth-access-label">
            Need access?
          </Typography>
          <Box className="auth-access-actions">
            <Button
              type="button"
              className="auth-access-link"
              onClick={() => navigate(RoutePath.VerifierSignup)}
            >
              Sign up as verifier
            </Button>
            <Typography component="span" className="auth-access-separator">
              or
            </Typography>
            <Button
              type="button"
              className="auth-access-link"
              onClick={() => navigate(RoutePath.IssuerRequest)}
            >
              Request issuer access
            </Button>
          </Box>
        </Box>
      }
    >
          <Button
            className="login-google-button"
            variant="outlined"
            disableElevation
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            startIcon={googleLoading ? <CircularProgress size={18} color="inherit" /> : <GoogleMark />}
          >
            {googleLoading ? "Connecting to Google" : "Sign in with Google"}
          </Button>

          <Divider className="login-divider">or sign in with email</Divider>

          <Box component="form" className="login-form" onSubmit={onSubmit}>
            <TextField
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              aria-label="Enter your email"
              size="medium"
              type="email"
              required
              fullWidth
            />
            <PasswordField
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              aria-label="Enter your password"
              size="medium"
              required
              fullWidth
            />

            <Box className="login-form-meta">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                }
                label="Remember me"
              />
              <Button
                type="button"
                className="login-forgot-button"
                onClick={handleForgotPassword}
              >
                Forgot password?
              </Button>
            </Box>

            <Button
              type="submit"
              variant="contained"
              className="login-submit-button primary-button"
              disableElevation
              disabled={loading || googleLoading}
            >
              {loginButtonContent}
            </Button>
          </Box>
    </AuthShell>
  );
};

export { Login };
