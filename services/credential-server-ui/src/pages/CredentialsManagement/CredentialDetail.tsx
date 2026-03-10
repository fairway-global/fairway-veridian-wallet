import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DoDisturbOnOutlinedIcon from "@mui/icons-material/DoDisturbOnOutlined";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { PopupModal } from "../../components/PopupModal";
import { RoutePath } from "../../const/route";
import { useSchemaDetail } from "../../hooks/SchemaDetail";
import { i18n } from "../../i18n";
import { ManagedCredentialService } from "../../services";
import { ManagedCredential } from "../../services/template.types";
import { formatDateTime } from "../../utils/dateFormatter";
import { getDisplaySchemaAttributes } from "../../utils/schemaAttributes";
import { triggerToast } from "../../utils/toast";

function getStatusStyles(status: string) {
  switch (status) {
    case "revoked":
      return {
        backgroundColor: "var(--color-error-100)",
        color: "var(--color-error-800)",
      };
    case "deleted":
      return {
        backgroundColor: "var(--color-neutral-200)",
        color: "var(--color-neutral-700)",
      };
    case "issued":
    default:
      return {
        backgroundColor: "var(--color-success-100)",
        color: "var(--color-success-900)",
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
        sx={{ color: "var(--color-neutral-600)", marginBottom: 0.5 }}
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

const CredentialDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const credentialId = String(id || "").trim();
  const [credential, setCredential] = useState<ManagedCredential | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const schemaDetail = useSchemaDetail(credential?.schemaId);

  const fetchCredential = async () => {
    if (!credentialId) {
      navigate(RoutePath.Credentials);
      return;
    }

    try {
      setLoading(true);
      const detail = await ManagedCredentialService.detail(credentialId);
      setCredential(detail);
    } catch {
      triggerToast(
        i18n.t("pages.credentialsManagement.messages.fetchError"),
        "error"
      );
      navigate(RoutePath.Credentials);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCredential();
  }, [credentialId]);

  const revokeCredential = async () => {
    if (!credentialId) {
      return;
    }

    try {
      await ManagedCredentialService.revoke(credentialId, credential?.holderDid);
      triggerToast(
        i18n.t("pages.credentialsManagement.messages.revokeSuccess"),
        "success"
      );
      setShowRevokeConfirm(false);
      await fetchCredential();
    } catch {
      triggerToast(
        i18n.t("pages.credentialsManagement.messages.revokeError"),
        "error"
      );
    }
  };

  const deleteCredential = async () => {
    if (!credentialId) {
      return;
    }

    try {
      await ManagedCredentialService.remove(credentialId);
      triggerToast(
        i18n.t("pages.credentialsManagement.messages.deleteSuccess"),
        "success"
      );
      navigate(RoutePath.Credentials);
    } catch {
      triggerToast(
        i18n.t("pages.credentialsManagement.messages.deleteError"),
        "error"
      );
    }
  };

  const displayAttributes = getDisplaySchemaAttributes(
    credential?.data || {},
    schemaDetail
  );

  return (
    <Box sx={{ padding: "0 2.5rem 2.5rem" }}>
      <PageHeader
        onBack={() => navigate(RoutePath.Credentials)}
        title={i18n.t("pages.credentialsManagement.detail.title")}
        action={
          <Stack
            direction="row"
            spacing={1}
          >
            <Button
              variant="contained"
              className="neutral-button"
              startIcon={<DoDisturbOnOutlinedIcon />}
              onClick={() => setShowRevokeConfirm(true)}
              disabled={!credential || credential.status !== "issued"}
            >
              {i18n.t("pages.credentialsManagement.actions.revoke")}
            </Button>
            <Button
              variant="contained"
              className="neutral-button"
              startIcon={<DeleteOutlineOutlinedIcon />}
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!credential}
            >
              {i18n.t("pages.credentialsManagement.actions.delete")}
            </Button>
          </Stack>
        }
        sx={{ margin: "1.5rem 0" }}
      />

      {loading && !credential ? (
        <Box
          sx={{
            minHeight: "50vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress />
        </Box>
      ) : null}

      {credential && (
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
                  "linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.08) 0%, rgba(var(--color-success-rgb), 0.10) 100%)",
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
                    {i18n.t("pages.credentialsManagement.detail.kicker")}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: "var(--text-color)",
                      fontWeight: 700,
                      marginTop: 0.5,
                    }}
                  >
                    {credential.templateName || credential.templateId}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: "var(--color-neutral-700)",
                      marginTop: 1,
                    }}
                  >
                    {schemaDetail?.title || credential.schemaId}
                  </Typography>
                </Box>
                <Chip
                  label={credential.status}
                  sx={{
                    ...getStatusStyles(credential.status),
                    fontWeight: 700,
                    alignSelf: "flex-start",
                    textTransform: "capitalize",
                  }}
                />
              </Stack>
            </Box>

            <Stack divider={<Divider />}>
              <Box sx={{ padding: { xs: "1.5rem", md: "2rem" } }}>
                <Typography
                  variant="h6"
                  sx={{ marginBottom: 2, fontWeight: 700 }}
                >
                  {i18n.t("pages.credentialsManagement.detail.summary")}
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
                    label={i18n.t("pages.credentialsManagement.detail.fields.id")}
                    value={credential.id}
                  />
                  <DetailItem
                    label={i18n.t("pages.credentialsManagement.detail.fields.issuedAt")}
                    value={formatDateTime(new Date(credential.issuedAt))}
                  />
                  <DetailItem
                    label={i18n.t("pages.credentialsManagement.detail.fields.schemaId")}
                    value={credential.schemaId}
                  />
                  <DetailItem
                    label={i18n.t("pages.credentialsManagement.detail.fields.holder")}
                    value={credential.holderDid}
                  />
                  <DetailItem
                    label={i18n.t("pages.credentialsManagement.detail.fields.template")}
                    value={credential.templateName || credential.templateId}
                  />
                  <DetailItem
                    label={i18n.t("pages.credentialsManagement.detail.fields.status")}
                    value={credential.status}
                  />
                </Box>
              </Box>

              <Box sx={{ padding: { xs: "1.5rem", md: "2rem" } }}>
                <Typography
                  variant="h6"
                  sx={{ marginBottom: 2, fontWeight: 700 }}
                >
                  {i18n.t("pages.credentialsManagement.detail.fields.data")}
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
                  {displayAttributes.map((attribute) => (
                    <Box
                      key={attribute.name}
                      sx={{
                        borderRadius: "1rem",
                        border: "1px solid rgba(var(--text-color-rgb), 0.08)",
                        background: "var(--color-neutral-100)",
                        padding: "1rem",
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: "var(--color-neutral-700)",
                          fontWeight: 700,
                          marginBottom: 0.75,
                        }}
                      >
                        {attribute.label}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          color: "var(--text-color)",
                          fontWeight: 600,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {attribute.value}
                      </Typography>
                      {attribute.description && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: "var(--color-neutral-600)",
                            marginTop: 0.75,
                          }}
                        >
                          {attribute.description}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
                {!displayAttributes.length && (
                  <Typography
                    variant="body2"
                    sx={{ color: "var(--color-neutral-600)" }}
                  >
                    {i18n.t("pages.credentialsManagement.detail.emptyAttributes")}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>
        </Stack>
      )}

      <PopupModal
        open={showRevokeConfirm}
        onClose={() => setShowRevokeConfirm(false)}
        title={i18n.t("pages.credentialsManagement.revoke.title")}
        description={i18n.t("pages.credentialsManagement.revoke.body")}
        footer={
          <>
            <Button
              variant="contained"
              className="neutral-button"
              onClick={() => setShowRevokeConfirm(false)}
            >
              {i18n.t("pages.credentialsManagement.revoke.cancel")}
            </Button>
            <Button
              variant="contained"
              onClick={revokeCredential}
              disabled={loading}
            >
              {i18n.t("pages.credentialsManagement.revoke.confirm")}
            </Button>
          </>
        }
      />
      <PopupModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={i18n.t("pages.credentialsManagement.delete.title")}
        description={i18n.t("pages.credentialsManagement.delete.body")}
        footer={
          <>
            <Button
              variant="contained"
              className="neutral-button"
              onClick={() => setShowDeleteConfirm(false)}
            >
              {i18n.t("pages.credentialsManagement.delete.cancel")}
            </Button>
            <Button
              variant="contained"
              onClick={deleteCredential}
              disabled={loading}
            >
              {i18n.t("pages.credentialsManagement.delete.confirm")}
            </Button>
          </>
        }
      />
    </Box>
  );
};

export { CredentialDetail };
