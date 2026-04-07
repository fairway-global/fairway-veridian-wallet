import {
  Box,
  Button,
  CircularProgress,
  Divider,
  TextField,
  Typography,
} from "@mui/material";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { config } from "../../config";
import { RoutePath } from "../../const/route";
import { AuthService } from "../../services/auth";
import { RoleIndex } from "../../components/NavBar/constants/roles";
import { useAppDispatch } from "../../store/hooks";
import { setSession } from "../../store/reducers/authSlice";
import { setRoleView } from "../../store/reducers/stateCache";
import { triggerToast } from "../../utils/toast";
import { AuthShell } from "./AuthShell";
import {
  GoogleCredentialResponse,
  GoogleMark,
} from "./GoogleIdentity";
import "./Login.scss";

const GOOGLE_SCRIPT_ID = "fairway-google-identity-signup-script";

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

const VerifierSignup = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

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

  const submitLabel = useMemo(
    () =>
      loading ? (
        <>
          <CircularProgress size={18} color="inherit" />
          <span>Creating access</span>
        </>
      ) : (
        "Create verifier access"
      ),
    [loading]
  );

  const completeLogin = useCallback(
    (session: Awaited<ReturnType<typeof AuthService.registerVerifier>>) => {
      dispatch(
        setSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user: session.user,
        })
      );
      dispatch(setRoleView(RoleIndex.VERIFIER));
      navigate(RoutePath.Activities);
    },
    [dispatch, navigate]
  );

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setGoogleLoading(false);
        triggerToast("Google sign up did not return a credential", "warning");
        return;
      }

      try {
        const session = await AuthService.registerVerifierWithGoogle({
          idToken: response.credential,
          organizationName: organizationName.trim() || undefined,
        });
        completeLogin(session);
        triggerToast("Verifier access created", "success");
      } catch (error) {
        triggerToast(
          getErrorMessage(error, "Unable to create verifier access with Google"),
          "error"
        );
      } finally {
        setGoogleLoading(false);
      }
    },
    [completeLogin, organizationName]
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

    if (!displayName.trim() || !email.trim() || !password) {
      triggerToast("Name, email and password are required", "error");
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
      setLoading(true);
      const session = await AuthService.registerVerifier({
        displayName: displayName.trim(),
        organizationName: organizationName.trim() || undefined,
        email: email.trim(),
        password,
      });
      completeLogin(session);
      triggerToast("Verifier access created", "success");
    } catch (error) {
      triggerToast(
        getErrorMessage(error, "Unable to create verifier access"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    if (!config.googleClientId) {
      triggerToast(
        "Google sign up is not configured. Set GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID and restart the UI.",
        "warning"
      );
      return;
    }

    if (!window.google?.accounts?.id) {
      triggerToast("Google sign up is still loading. Please try again.", "info");
      return;
    }

    setGoogleLoading(true);
    window.google.accounts.id.prompt((notification) => {
      if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
        setGoogleLoading(false);
        triggerToast(
          "Google sign up could not open. Please try email sign up or retry.",
          "warning"
        );
      }
    });
  };

  return (
    <AuthShell
      pageClassName="login-page--auth-trimmed"
      title="Create verifier access"
      subtitle="Open a Fairwallet verifier workspace and start reviewing presentation flows right away."
      footer={
        <>
          <Typography component="p">
            Already have access?{" "}
            <Link className="auth-inline-link" to={RoutePath.Login}>
              Sign in
            </Link>
          </Typography>
          <Typography component="p">
            Need issuer access instead?{" "}
            <Link className="auth-inline-link" to={RoutePath.IssuerRequest}>
              Request issuer access
            </Link>
          </Typography>
        </>
      }
    >
      <Box component="form" className="login-form" onSubmit={onSubmit}>
        <Button
          className="login-google-button"
          variant="outlined"
          disableElevation
          onClick={handleGoogleSignup}
          disabled={googleLoading || loading}
          startIcon={
            googleLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <GoogleMark />
            )
          }
        >
          {googleLoading ? "Connecting to Google" : "Sign up with Google"}
        </Button>

        <Divider className="login-divider">or sign up with email</Divider>

        <TextField
          size="small"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Enter your full name"
          aria-label="Enter your full name"
          required
          fullWidth
        />
        <TextField
          size="small"
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
          placeholder="Organization or team name"
          aria-label="Organization or team name"
          fullWidth
        />
        <TextField
          size="small"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          aria-label="Enter your email"
          type="email"
          required
          fullWidth
        />
        <TextField
          size="small"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Create a password"
          aria-label="Create a password"
          type="password"
          required
          fullWidth
        />
        <TextField
          size="small"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm your password"
          aria-label="Confirm your password"
          type="password"
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          className="login-submit-button primary-button"
          disableElevation
          disabled={loading || googleLoading}
        >
          {submitLabel}
        </Button>
      </Box>
    </AuthShell>
  );
};

export { VerifierSignup };
