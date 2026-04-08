import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RoutePath } from "../../const/route";
import { AuthService } from "../../services/auth";
import { triggerToast } from "../../utils/toast";
import { AuthShell } from "./AuthShell";
import "./Login.scss";

const organizationTypeOptions = [
  "Government",
  "University",
  "School",
  "Company",
  "Nonprofit",
  "Other",
];

const expectedVolumeOptions = [
  "Under 100 per month",
  "100-500 per month",
  "500-2,000 per month",
  "2,000+ per month",
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

const IssuerRequest = () => {
  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [credentialUseCase, setCredentialUseCase] = useState("");
  const [expectedVolume, setExpectedVolume] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");

  const submitLabel = useMemo(
    () =>
      loading ? (
        <>
          <CircularProgress size={18} color="inherit" />
          <span>Sending request</span>
        </>
      ) : (
        "Request issuer access"
      ),
    [loading]
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (
      !organizationName.trim() ||
      !contactName.trim() ||
      !email.trim() ||
      !credentialUseCase.trim()
    ) {
      triggerToast(
        "Organization, contact name, email and use case are required",
        "error"
      );
      return;
    }

    try {
      setLoading(true);
      const response = await AuthService.requestIssuerAccess({
        organizationName: organizationName.trim(),
        organizationType: organizationType || undefined,
        contactName: contactName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        country: country.trim() || undefined,
        website: website.trim() || undefined,
        credentialUseCase: credentialUseCase.trim(),
        expectedVolume: expectedVolume || undefined,
        notes: notes.trim() || undefined,
      });
      setSubmittedMessage(response.message);
      triggerToast("Issuer request submitted", "success");
    } catch (error) {
      triggerToast(
        getErrorMessage(error, "Unable to submit issuer request"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      pageClassName="login-page--auth-trimmed"
      title="Request issuer access"
      subtitle="Share the essentials about your institution and we will review your Fairwallet issuer setup."
      footer={
        <>
          <Typography component="p">
            Already have access?{" "}
            <Link className="auth-inline-link" to={RoutePath.Login}>
              Sign in
            </Link>
          </Typography>
          <Typography component="p">
            Need verifier access right away?{" "}
            <Link className="auth-inline-link" to={RoutePath.VerifierSignup}>
              Create verifier access
            </Link>
          </Typography>
        </>
      }
    >
      {submittedMessage ? (
        <Box className="auth-success-card">
          <Typography className="auth-success-title">
            Request received
          </Typography>
          <Typography className="auth-success-copy">
            {submittedMessage}
          </Typography>
          <Box className="auth-action-stack">
            <Button
              component={Link}
              to={RoutePath.Login}
              variant="contained"
              className="login-submit-button primary-button"
              disableElevation
            >
              Back to sign in
            </Button>
            <Button
              component={Link}
              to={RoutePath.VerifierSignup}
              variant="outlined"
              className="login-google-button"
            >
              Create verifier access instead
            </Button>
          </Box>
        </Box>
      ) : (
        <Box component="form" className="login-form" onSubmit={onSubmit}>
          <Box className="auth-form-grid">
            <TextField
              size="small"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="Organization name"
              aria-label="Organization name"
              required
              fullWidth
            />
            <TextField
              size="small"
              select
              value={organizationType}
              onChange={(event) => setOrganizationType(event.target.value)}
              aria-label="Organization type"
              fullWidth
              SelectProps={{
                displayEmpty: true,
                renderValue: (value) => {
                  const selectedValue = String(value || "");
                  return selectedValue ? (
                    selectedValue
                  ) : (
                    <span className="auth-select-placeholder">
                      Organization type
                    </span>
                  );
                },
              }}
            >
              {organizationTypeOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Contact full name"
              aria-label="Contact full name"
              required
              fullWidth
            />
            <TextField
              size="small"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Work email"
              aria-label="Work email"
              type="email"
              required
              fullWidth
            />
            <TextField
              size="small"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Phone number"
              aria-label="Phone number"
              fullWidth
            />
            <TextField
              size="small"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="Country"
              aria-label="Country"
              fullWidth
            />
            <TextField
              size="small"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="Website"
              aria-label="Website"
              fullWidth
            />
            <TextField
              size="small"
              select
              value={expectedVolume}
              onChange={(event) => setExpectedVolume(event.target.value)}
              aria-label="Expected volume"
              fullWidth
              SelectProps={{
                displayEmpty: true,
                renderValue: (value) => {
                  const selectedValue = String(value || "");
                  return selectedValue ? (
                    selectedValue
                  ) : (
                    <span className="auth-select-placeholder">
                      Expected credential volume
                    </span>
                  );
                },
              }}
            >
              {expectedVolumeOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField
            size="small"
            value={credentialUseCase}
            onChange={(event) => setCredentialUseCase(event.target.value)}
            placeholder="Describe what credentials you want to issue and why"
            aria-label="Describe what credentials you want to issue and why"
            required
            fullWidth
            multiline
            minRows={1}
          />
          <TextField
            size="small"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything else we should know?"
            aria-label="Anything else we should know?"
            fullWidth
            multiline
            minRows={1}
          />
          <Button
            type="submit"
            variant="contained"
            className="login-submit-button primary-button"
            disableElevation
            disabled={loading}
          >
            {submitLabel}
          </Button>
        </Box>
      )}
    </AuthShell>
  );
};

export { IssuerRequest };
