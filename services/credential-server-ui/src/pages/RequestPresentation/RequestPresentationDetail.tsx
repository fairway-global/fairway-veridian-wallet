import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { RoutePath } from "../../const/route";
import { useSchemaDetail } from "../../hooks/SchemaDetail";
import { i18n } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchPresentationRequests } from "../../store/reducers/connectionsSlice";
import {
  PresentationRequestStatus,
} from "../../store/reducers/connectionsSlice.types";
import { formatDateTime } from "../../utils/dateFormatter";
import {
  formatSchemaAttributeLabel,
  getDisplaySchemaAttributes,
  getSchemaAttributeDefinitions,
} from "../../utils/schemaAttributes";

function getStatusChipStyles(status: PresentationRequestStatus) {
  switch (status) {
    case PresentationRequestStatus.Completed:
      return {
        backgroundColor: "var(--color-success-100)",
        color: "var(--color-success-900)",
      };
    case PresentationRequestStatus.Verified:
      return {
        backgroundColor: "var(--color-primary-100)",
        color: "var(--color-primary-800)",
      };
    case PresentationRequestStatus.Rejected:
    case PresentationRequestStatus.Failed:
      return {
        backgroundColor: "var(--color-error-100)",
        color: "var(--color-error-800)",
      };
    case PresentationRequestStatus.Requested:
    default:
      return {
        backgroundColor: "var(--color-warning-100)",
        color: "var(--color-warning-800)",
      };
  }
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Box>
      <Typography
        variant="body2"
        sx={{
          color: "var(--color-neutral-600)",
          marginBottom: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: "var(--text-color)",
          fontWeight: 600,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function AttributeCard({
  label,
  value,
  description,
  tone = "neutral",
}: {
  label: string;
  value: string;
  description?: string;
  tone?: "neutral" | "accent";
}) {
  return (
    <Box
      sx={{
        borderRadius: "1rem",
        border: "1px solid rgba(var(--text-color-rgb), 0.08)",
        background:
          tone === "accent"
            ? "linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.08) 0%, rgba(var(--primary-color-rgb), 0.02) 100%)"
            : "var(--color-neutral-100)",
        padding: "1rem",
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          color: "var(--color-neutral-700)",
          marginBottom: 0.75,
          fontWeight: 700,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: "var(--text-color)",
          fontWeight: 600,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          sx={{
            color: "var(--color-neutral-600)",
            marginTop: 0.75,
          }}
        >
          {description}
        </Typography>
      )}
    </Box>
  );
}

export const RequestPresentationDetail = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams();
  const requestId = String(id || "").trim();
  const [loading, setLoading] = useState(false);

  const presentationRequests = useAppSelector(
    (state) => state.connections.presentationRequests
  );
  const contacts = useAppSelector((state) => state.connections.contacts);
  const schemas = useAppSelector((state) => state.schemasCache.schemas);

  const request = presentationRequests.find((item) => item.id === requestId);
  const schemaDetail = useSchemaDetail(request?.schemaId);

  useEffect(() => {
    if (!requestId) {
      navigate(RoutePath.RequestPresentation);
      return;
    }

    if (request) {
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        await dispatch(fetchPresentationRequests());
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [dispatch, navigate, request, requestId]);

  const contact = contacts.find((item) => item.id === request?.holderDid);
  const schema = schemas.find((item) => item.id === request?.schemaId);
  const schemaAttributes = useMemo(
    () => getSchemaAttributeDefinitions(schemaDetail),
    [schemaDetail]
  );
  const requestedFieldCards = useMemo(() => {
    if (!request) {
      return [];
    }

    if (schemaAttributes.length) {
      return schemaAttributes.map((schemaAttribute) => ({
        label: schemaAttribute.label,
        description: schemaAttribute.description,
        value:
          String(request.requestedAttributes[schemaAttribute.name] || "").trim() ||
          i18n.t("pages.requestPresentation.detail.anyValue"),
      }));
    }

    return Object.entries(request.requestedAttributes || {}).map(([key, value]) => ({
      label: formatSchemaAttributeLabel(key),
      description: "",
      value: String(value || "").trim(),
    }));
  }, [request, schemaAttributes]);
  const presentedAttributes = useMemo(
    () =>
      request
        ? getDisplaySchemaAttributes(request.presentedAttributes, schemaDetail)
        : [],
    [request, schemaDetail]
  );
  const verificationChecks = useMemo(() => {
    if (!request) {
      return [];
    }

    return Object.entries(request.verificationChecks || {}).map(
      ([key, value]) => ({
        label: formatSchemaAttributeLabel(key),
        passed: Boolean(value),
      })
    );
  }, [request]);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!request) {
    return (
      <Box sx={{ padding: "0 2.5rem 2.5rem" }}>
        <PageHeader
          onBack={() => navigate(RoutePath.RequestPresentation)}
          title={i18n.t("pages.requestPresentation.detail.title")}
          sx={{ margin: "1.5rem 0" }}
        />
        <Paper
          sx={{
            borderRadius: "1rem",
            padding: "2rem",
            boxShadow:
              "0.25rem 0.25rem 1.25rem 0 rgba(var(--text-color-rgb), 0.16)",
          }}
        >
          <Typography variant="body1">
            {i18n.t("pages.requestPresentation.detail.notFound")}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ padding: "0 2.5rem 2.5rem" }}>
      <PageHeader
        onBack={() => navigate(RoutePath.RequestPresentation)}
        title={i18n.t("pages.requestPresentation.detail.title")}
        sx={{ margin: "1.5rem 0" }}
      />

      <Stack spacing={2}>
        <Paper
          sx={{
            borderRadius: "1rem",
            overflow: "hidden",
            boxShadow:
              "0.25rem 0.25rem 1.25rem 0 rgba(var(--text-color-rgb), 0.16)",
          }}
        >
          <Box
            sx={{
              padding: { xs: "1.5rem", md: "2rem" },
              background:
                "linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.10) 0%, rgba(var(--color-success-rgb), 0.08) 100%)",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography
                  variant="overline"
                  sx={{ color: "var(--color-neutral-700)" }}
                >
                  {i18n.t("pages.requestPresentation.detail.kicker")}
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    color: "var(--text-color)",
                    fontWeight: 700,
                    marginTop: 0.5,
                  }}
                >
                  {schema?.name || request.schemaId}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: "var(--color-neutral-700)",
                    marginTop: 1,
                  }}
                >
                  {contact?.alias || request.holderDid}
                </Typography>
              </Box>
              <Chip
                label={i18n.t(
                  `pages.requestPresentation.table.status.${request.status}`
                )}
                sx={{
                  ...getStatusChipStyles(request.status),
                  fontWeight: 700,
                  alignSelf: "flex-start",
                }}
              />
            </Stack>
          </Box>

          <Stack
            divider={<Divider />}
            spacing={0}
          >
            <Box sx={{ padding: { xs: "1.5rem", md: "2rem" } }}>
              <Typography
                variant="h6"
                sx={{ marginBottom: 2, fontWeight: 700 }}
              >
                {i18n.t("pages.requestPresentation.detail.summary")}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                <DetailItem
                  label={i18n.t("pages.requestPresentation.detail.fields.requestedAt")}
                  value={formatDateTime(new Date(request.requestDate))}
                />
                <DetailItem
                  label={i18n.t("pages.requestPresentation.detail.fields.result")}
                  value={
                    request.failureReason ||
                    (request.status === PresentationRequestStatus.Verified ||
                    request.status === PresentationRequestStatus.Completed
                      ? request.presentedCredentialId
                        ? `${i18n.t("pages.requestPresentation.table.resultVerified")} ${request.presentedCredentialId}`
                        : i18n.t("pages.requestPresentation.table.resultVerified")
                      : i18n.t("pages.requestPresentation.table.resultPending"))
                  }
                />
                <DetailItem
                  label={i18n.t("pages.requestPresentation.detail.fields.requestExnSaid")}
                  value={request.requestExnSaid}
                />
                <DetailItem
                  label={i18n.t("pages.requestPresentation.detail.fields.schemaId")}
                  value={request.schemaId}
                />
                <DetailItem
                  label={i18n.t("pages.requestPresentation.detail.fields.holderDid")}
                  value={request.holderDid}
                />
                <DetailItem
                  label={i18n.t("pages.requestPresentation.detail.fields.presentedCredentialId")}
                  value={
                    request.presentedCredentialId ||
                    i18n.t("pages.requestPresentation.detail.pending")
                  }
                />
              </Box>
            </Box>

            <Box sx={{ padding: { xs: "1.5rem", md: "2rem" } }}>
              <Typography
                variant="h6"
                sx={{ marginBottom: 2, fontWeight: 700 }}
              >
                {i18n.t("pages.requestPresentation.detail.requiredFields")}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {requestedFieldCards.map((field) => (
                  <AttributeCard
                    key={field.label}
                    label={field.label}
                    value={field.value}
                    description={field.description}
                    tone="accent"
                  />
                ))}
              </Box>
            </Box>

            {(presentedAttributes.length > 0 || verificationChecks.length > 0) && (
              <Box sx={{ padding: { xs: "1.5rem", md: "2rem" } }}>
                <Typography
                  variant="h6"
                  sx={{ marginBottom: 2, fontWeight: 700 }}
                >
                  {i18n.t("pages.requestPresentation.detail.presentation")}
                </Typography>
                {presentedAttributes.length > 0 && (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 2,
                      marginBottom: verificationChecks.length ? 2 : 0,
                    }}
                  >
                    {presentedAttributes.map((attribute) => (
                      <AttributeCard
                        key={attribute.name}
                        label={attribute.label}
                        value={attribute.value}
                        description={attribute.description}
                      />
                    ))}
                  </Box>
                )}
                {verificationChecks.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                  >
                    {verificationChecks.map((check) => (
                      <Chip
                        key={check.label}
                        label={check.label}
                        sx={{
                          backgroundColor: check.passed
                            ? "var(--color-success-100)"
                            : "var(--color-error-100)",
                          color: check.passed
                            ? "var(--color-success-900)"
                            : "var(--color-error-800)",
                          fontWeight: 700,
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};
