import { Box, Chip, Typography } from "@mui/material";
import CredentialBG from "../../assets/credential-bg.svg";
import { i18n } from "../../i18n";
import { ReviewProps } from "./RequestPresentationModal.types";

const Review = ({
  credentialType,
  connectionId,
  connections,
  attribute,
  schemaAttributes,
}: ReviewProps) => {
  if (!credentialType || !connectionId) return null;

  const connectionName = connections.find(
    (item) => item.id === connectionId
  )?.alias;
  const filledAttributes = schemaAttributes.filter(
    (schemaAttribute) => String(attribute[schemaAttribute.name] || "").trim()
  );

  return (
    <Box className="review-stage">
      <Box sx={{ textAlign: "left", marginBottom: "1.5rem" }}>
        <Typography variant="subtitle1">
          {i18n.t("pages.credentialDetails.issueCredential.review.credential")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            marginBottom: "1.5rem",
          }}
        >
          <img
            width={36}
            src={CredentialBG}
            alt="schema-name"
          />
          <Typography
            className="content"
            variant="body2"
          >
            {credentialType}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ textAlign: "left", marginBottom: "1.5rem" }}>
        <Typography variant="subtitle1">
          {i18n.t("pages.credentialDetails.issueCredential.review.issueTo")}
        </Typography>
        <Typography
          className="content"
          variant="body2"
        >
          {connectionName}
        </Typography>
      </Box>
      {filledAttributes.map((schemaAttribute) => (
        <Box
          key={schemaAttribute.name}
          sx={{
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            marginBottom: "1rem",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle1">{schemaAttribute.label}</Typography>
            {schemaAttribute.required && (
              <Chip
                label={i18n.t("pages.requestPresentation.modal.inputAttribute.required")}
                size="small"
                sx={{
                  backgroundColor: "var(--color-success-100)",
                  color: "var(--color-success-900)",
                  fontWeight: 600,
                }}
              />
            )}
          </Box>
          {schemaAttribute.description && (
            <Typography
              variant="body2"
              sx={{ color: "var(--color-neutral-600)" }}
            >
              {schemaAttribute.description}
            </Typography>
          )}
          <Typography
            className="content"
            variant="body2"
          >
            {attribute[schemaAttribute.name]}
          </Typography>
        </Box>
      ))}
      {!filledAttributes.length && (
        <Typography
          variant="body2"
          sx={{ textAlign: "left", color: "var(--color-neutral-600)" }}
        >
          {i18n.t("pages.requestPresentation.modal.review.anyMatchingCredential")}
        </Typography>
      )}
    </Box>
  );
};

export { Review };
