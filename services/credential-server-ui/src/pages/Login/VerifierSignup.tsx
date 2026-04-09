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
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { config } from "../../config";
import { RoutePath } from "../../const/route";
import { PasswordField } from "../../components/PasswordField";
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
import { GoogleAccountSetupDialog } from "./GoogleAccountSetupDialog";
import { getErrorMessage, isGoogleAccountNotFoundError } from "./authErrors";
import "./Login.scss";

const GOOGLE_SCRIPT_ID = "fairway-google-identity-signup-script";

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
  const [googleSetupOpen, setGoogleSetupOpen] = useState(false);
  const [googleSetupLoading, setGoogleSetupLoading] = useState(false);
  const [googleSetupOrganizationName, setGoogleSetupOrganizationName] =
    useState("");
  const [pendingGoogleIdToken, setPendingGoogleIdToken] = useState<string | null>(
    null
  );
  const googleButtonHostRef = useRef<HTMLDivElement | null>(null);

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

  const resetGoogleSetup = useCallback(() => {
    setGoogleSetupOpen(false);
    setGoogleSetupOrganizationName("");
    setPendingGoogleIdToken(null);
  }, []);

  const closeGoogleSetup = useCallback(() => {
    if (googleSetupLoading) {
      return;
    }

    resetGoogleSetup();
  }, [googleSetupLoading, resetGoogleSetup]);

  const submitGoogleSetup = useCallback(async () => {
    if (!pendingGoogleIdToken) {
      return;
    }

    try {
      setGoogleSetupLoading(true);
      const session = await AuthService.registerVerifierWithGoogle({
        idToken: pendingGoogleIdToken,
        organizationName: googleSetupOrganizationName.trim() || undefined,
      });
      resetGoogleSetup();
      completeLogin(session);
      triggerToast("Verifier access created", "success");
    } catch (error) {
      triggerToast(
        getErrorMessage(error, "Unable to create verifier access with Google"),
        "error"
      );
    } finally {
      setGoogleSetupLoading(false);
    }
  }, [
    completeLogin,
    googleSetupOrganizationName,
    pendingGoogleIdToken,
    resetGoogleSetup,
  ]);

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setGoogleLoading(false);
        triggerToast("Google did not return a credential", "warning");
        return;
      }

      try {
        setGoogleLoading(true);
        const session = await AuthService.googleLogin({
          idToken: response.credential,
        });
        completeLogin(session);
      } catch (error) {
        if (isGoogleAccountNotFoundError(error)) {
          setPendingGoogleIdToken(response.credential);
          setGoogleSetupOrganizationName(organizationName.trim());
          setGoogleSetupOpen(true);
          return;
        }

        triggerToast(
          getErrorMessage(error, "Google authentication failed"),
          "error"
        );
      } finally {
        setGoogleLoading(false);
      }
    },
    [completeLogin, organizationName]
  );

  useEffect(() => {
    if (
      !googleReady ||
      !config.googleClientId ||
      !window.google?.accounts?.id ||
      !googleButtonHostRef.current
    ) {
      return;
    }

    const googleIdentity = window.google.accounts.id;
    const host = googleButtonHostRef.current;

    const renderGoogleButton = () => {
      const width = Math.max(Math.floor(host.getBoundingClientRect().width), 260);
      host.replaceChildren();
      googleIdentity.renderButton(host, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: String(width),
        logo_alignment: "left",
      });
    };

    googleIdentity.initialize({
      client_id: config.googleClientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    renderGoogleButton();
    window.addEventListener("resize", renderGoogleButton);

    return () => {
      window.removeEventListener("resize", renderGoogleButton);
    };
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
        "Google sign in is not configured. Set GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID and restart the UI.",
        "warning"
      );
      return;
    }

    if (!window.google?.accounts?.id) {
      triggerToast("Google is still loading. Please try again.", "info");
    }
  };

  return (
    <Fragment>
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
          <Box className="login-google-button-shell">
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
              {googleLoading ? "Connecting to Google" : "Continue with Google"}
            </Button>
            <Box
              ref={googleButtonHostRef}
              className={[
                "google-button-host",
                googleReady && !googleLoading && !loading
                  ? "google-button-host--interactive"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            />
          </Box>

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
          <PasswordField
            size="small"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            aria-label="Create a password"
            required
            fullWidth
          />
          <PasswordField
            size="small"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm your password"
            aria-label="Confirm your password"
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
      <GoogleAccountSetupDialog
        open={googleSetupOpen}
        organizationName={googleSetupOrganizationName}
        loading={googleSetupLoading}
        onOrganizationNameChange={setGoogleSetupOrganizationName}
        onClose={closeGoogleSetup}
        onSubmit={() => {
          void submitGoogleSetup();
        }}
      />
    </Fragment>
  );
};

export { VerifierSignup };
