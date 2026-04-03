import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import LogoLong from "../../assets/fw-white-logo.png";
import { config } from "../../config";
import { RoutePath } from "../../const/route";
import { AuthService, AuthSessionResponse } from "../../services/auth";
import { useAppDispatch } from "../../store/hooks";
import { setSession } from "../../store/reducers/authSlice";
import { setRoleView } from "../../store/reducers/stateCache";
import { triggerToast } from "../../utils/toast";
import { RoleIndex } from "../../components/NavBar/constants/roles";
import "./Login.scss";

const GOOGLE_SCRIPT_ID = "fairway-google-identity-script";
const REMEMBERED_EMAIL_KEY = "credential_server_ui_remembered_email";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GooglePromptMomentNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
}

interface GoogleAccountsIdApi {
  initialize: (input: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  prompt: (listener?: (notification: GooglePromptMomentNotification) => void) => void;
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
        "Google sign in is not configured. Set GOOGLE_CLIENT_ID first.",
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
    triggerToast("Forgot password? Contact your administrator.", "info");
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
    <Box className="login-page">
      <Paper className="login-card">
        <Box className="login-panel login-panel--form">
          <Box className="login-brand">
            <img src={LogoLong} alt="Fairway" />
          </Box>

          <Box className="login-copy">
            <Typography className="login-title" component="h1">
              Sign in to Fairway
            </Typography>
            <Typography className="login-subtitle">
              Access your credential operations dashboard securely.
            </Typography>
          </Box>

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
            <TextField
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              aria-label="Enter your password"
              size="medium"
              type="password"
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

          <Typography className="login-footer-copy">
            Need access? Contact your administrator
          </Typography>
        </Box>

        <Box className="login-panel login-panel--welcome">
          <Box className="welcome-orb welcome-orb--top" />
          <Box className="welcome-orb welcome-orb--bottom" />
          <Typography className="welcome-eyebrow">Welcome to</Typography>
          <Typography className="welcome-title">
            Fairway Credential Manager
          </Typography>
          <Typography className="welcome-body">
            Manage credential issuance, identity verification, and trusted digital workflows in one secure place.
            Built for institutions to issue and manage credentials with clarity, speed, and confidence.
          </Typography>
          <Box className="welcome-stat">
            <Typography className="welcome-stat-label">
              Trusted dashboard
            </Typography>
            <Typography className="welcome-stat-value">
              Secure credential operations for issuers and verifiers
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export { Login };
