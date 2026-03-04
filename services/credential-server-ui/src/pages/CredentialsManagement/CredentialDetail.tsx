import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DoDisturbOnOutlinedIcon from "@mui/icons-material/DoDisturbOnOutlined";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { PopupModal } from "../../components/PopupModal";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { ManagedCredentialService } from "../../services";
import { ManagedCredential } from "../../services/template.types";
import { formatDateTime } from "../../utils/dateFormatter";
import { triggerToast } from "../../utils/toast";

const CredentialDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const credentialId = String(id || "").trim();
  const [credential, setCredential] = useState<ManagedCredential | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

      {credential && (
        <Paper
          sx={{
            borderRadius: "1rem",
            padding: "1rem",
            boxShadow:
              "0.25rem 0.25rem 1.25rem 0 rgba(var(--text-color-rgb), 0.16)",
          }}
        >
          <Stack spacing={1}>
            <Typography>
              <strong>{i18n.t("pages.credentialsManagement.detail.fields.id")}:</strong>{" "}
              {credential.id}
            </Typography>
            <Typography>
              <strong>
                {i18n.t("pages.credentialsManagement.detail.fields.template")}:
              </strong>{" "}
              {credential.templateName || credential.templateId}
            </Typography>
            <Typography>
              <strong>
                {i18n.t("pages.credentialsManagement.detail.fields.schemaId")}:
              </strong>{" "}
              {credential.schemaId}
            </Typography>
            <Typography>
              <strong>
                {i18n.t("pages.credentialsManagement.detail.fields.holder")}:
              </strong>{" "}
              {credential.holderDid}
            </Typography>
            <Typography>
              <strong>
                {i18n.t("pages.credentialsManagement.detail.fields.status")}:
              </strong>{" "}
              {credential.status}
            </Typography>
            <Typography>
              <strong>
                {i18n.t("pages.credentialsManagement.detail.fields.issuedAt")}:
              </strong>{" "}
              {formatDateTime(new Date(credential.issuedAt))}
            </Typography>
            <Typography>
              <strong>{i18n.t("pages.credentialsManagement.detail.fields.data")}:</strong>
            </Typography>
            {Object.entries(credential.data || {}).map(([key, value]) => (
              <Typography key={key}>
                {key}: {String(value)}
              </Typography>
            ))}
          </Stack>
        </Paper>
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
