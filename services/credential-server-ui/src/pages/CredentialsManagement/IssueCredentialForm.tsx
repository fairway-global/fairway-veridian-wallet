import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { ContactService, ManagedCredentialService, TemplateService } from "../../services";
import { CredentialTemplate } from "../../services/template.types";
import { triggerToast } from "../../utils/toast";
import "../../styles/dashboardForms.scss";

interface ConnectionOption {
  id: string;
  alias: string;
}

const IssueCredentialForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [templates, setTemplates] = useState<CredentialTemplate[]>([]);
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [templateId, setTemplateId] = useState(
    String(searchParams.get("templateId") || "").trim()
  );
  const [connectionId, setConnectionId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [prefilledFields, setPrefilledFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateRouteWarning, setTemplateRouteWarning] = useState<string | null>(
    null
  );

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        setLoading(true);
        const [templateList, contactsResponse] = await Promise.all([
          TemplateService.list(),
          ContactService.list(),
        ]);

        const contacts = Array.isArray(contactsResponse.data?.data)
          ? contactsResponse.data.data
          : [];

        setTemplates(templateList);
        setConnections(
          contacts.map((contact: { id: string; alias?: string }) => ({
            id: contact.id,
            alias: contact.alias || contact.id,
          }))
        );

        const requestedTemplateId = String(
          searchParams.get("templateId") || ""
        ).trim();

        if (
          requestedTemplateId &&
          templateList.length &&
          !templateList.some((template) => template.id === requestedTemplateId)
        ) {
          setTemplateRouteWarning(
            "That template is no longer available, so we picked the first template in your list."
          );
          setTemplateId(templateList[0].id);
          return;
        }

        setTemplateRouteWarning(null);

        if (!requestedTemplateId && templateList.length) {
          setTemplateId((currentValue) => currentValue || templateList[0].id);
        }
      } catch {
        triggerToast(i18n.t("pages.credentialsManagement.messages.fetchError"), "error");
      } finally {
        setLoading(false);
      }
    };

    void fetchDependencies();
  }, [searchParams]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) || null,
    [templateId, templates]
  );

  const requiredAttributes = useMemo(
    () =>
      (selectedTemplate?.attributes || [])
        .filter((attribute) => attribute.required)
        .map((attribute) => attribute.name),
    [selectedTemplate?.attributes]
  );

  const canSubmit = useMemo(() => {
    if (!templateId || !connectionId) {
      return false;
    }

    return requiredAttributes.every((attributeName) =>
      String(values[attributeName] || "").trim()
    );
  }, [connectionId, requiredAttributes, templateId, values]);

  const hasTemplates = templates.length > 0;
  const hasConnections = connections.length > 0;

  const submit = async () => {
    if (!templateId || !connectionId) {
      triggerToast(i18n.t("pages.credentialsManagement.messages.validation"), "error");
      return;
    }

    try {
      setLoading(true);
      const credential = await ManagedCredentialService.issue({
        templateId,
        connectionId,
        values,
      });

      triggerToast(i18n.t("pages.credentialsManagement.messages.issueSuccess"), "success");
      navigate(RoutePath.CredentialDetails.replace(":id", credential.id));
    } catch {
      triggerToast(i18n.t("pages.credentialsManagement.messages.issueError"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadPrefill = async () => {
      if (!templateId || !connectionId || !selectedTemplate) {
        setPrefilledFields([]);
        return;
      }

      try {
        const prefill = await ManagedCredentialService.getIssuePrefill(
          templateId,
          connectionId
        );

        if (cancelled) {
          return;
        }

        setValues(
          Object.fromEntries(
            selectedTemplate.attributes.map((attribute) => {
              const rawValue = prefill.values[attribute.name];
              return [
                attribute.name,
                rawValue === undefined || rawValue === null ? "" : String(rawValue),
              ];
            })
          )
        );
        setPrefilledFields(prefill.matchedFields);
      } catch {
        if (cancelled) {
          return;
        }

        setValues({});
        setPrefilledFields([]);
      }
    };

    void loadPrefill();

    return () => {
      cancelled = true;
    };
  }, [connectionId, selectedTemplate, templateId]);

  return (
    <Box
      sx={{
        padding: {
          xs: "0 1rem 1.5rem",
          sm: "0 1.5rem 2rem",
          lg: "0 2.5rem 2.5rem",
        },
      }}
    >
      <PageHeader
        onBack={() => navigate(RoutePath.Credentials)}
        title={i18n.t("pages.credentialsManagement.issue.title")}
        sx={{
          margin: {
            xs: "1rem 0",
            md: "1.5rem 0",
          },
        }}
      />
      <Box className="dashboard-form-shell">
        {!loading && !hasTemplates ? (
          <Box className="dashboard-guidance-panel dashboard-guidance-panel--warning">
            <Box className="dashboard-guidance-panel__header">
              <Box className="dashboard-guidance-panel__icon">
                <DescriptionOutlinedIcon />
              </Box>
              <Box>
                <Typography className="dashboard-guidance-panel__eyebrow">
                  First step
                </Typography>
                <Typography className="dashboard-guidance-panel__title">
                  You must first create a template before issuing a credential.
                </Typography>
              </Box>
            </Box>
            <Typography className="dashboard-guidance-panel__description">
              Templates define the fields, schema, and rules your team uses
              during issuance. Create one first, then come back here to issue a
              credential to a connection.
            </Typography>
            <Box className="dashboard-guidance-panel__actions">
              <Button
                variant="contained"
                onClick={() => navigate(RoutePath.TemplateCreate)}
              >
                Create template
              </Button>
              <Button
                variant="contained"
                className="neutral-button"
                onClick={() => navigate(RoutePath.Credentials)}
              >
                Back to credentials
              </Button>
            </Box>
          </Box>
        ) : !loading && !hasConnections ? (
          <Box className="dashboard-guidance-panel dashboard-guidance-panel--info">
            <Box className="dashboard-guidance-panel__header">
              <Box className="dashboard-guidance-panel__icon">
                <PeopleAltOutlinedIcon />
              </Box>
              <Box>
                <Typography className="dashboard-guidance-panel__eyebrow">
                  Before issuing
                </Typography>
                <Typography className="dashboard-guidance-panel__title">
                  You need at least one connection before issuing a credential.
                </Typography>
              </Box>
            </Box>
            <Typography className="dashboard-guidance-panel__description">
              Credentials can only be issued to an existing connection. Create
              or accept a connection first, then return here and choose the
              holder you want to issue to.
            </Typography>
            <Box className="dashboard-guidance-panel__actions">
              <Button
                variant="contained"
                onClick={() => navigate(RoutePath.Connections)}
              >
                Open connections
              </Button>
              <Button
                variant="contained"
                className="neutral-button"
                onClick={() => navigate(RoutePath.Credentials)}
              >
                Back to credentials
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <Box className="dashboard-form-panel">
              <Box className="dashboard-form-grid dashboard-form-grid--two-up">
                <TextField
                  select
                  label={i18n.t("pages.credentialsManagement.issue.template")}
                  value={templateId}
                  onChange={(event) => {
                    setTemplateId(event.target.value);
                    setValues({});
                    setPrefilledFields([]);
                  }}
                  fullWidth
                >
                  {templates.map((template) => (
                    <MenuItem
                      key={template.id}
                      value={template.id}
                    >
                      {template.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label={i18n.t("pages.credentialsManagement.issue.connection")}
                  value={connectionId}
                  onChange={(event) => {
                    setConnectionId(event.target.value);
                    setValues({});
                    setPrefilledFields([]);
                  }}
                  fullWidth
                >
                  {connections.map((connection) => (
                    <MenuItem
                      key={connection.id}
                      value={connection.id}
                    >
                      {connection.alias}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              {templateRouteWarning && (
                <Typography
                  variant="body2"
                  className="dashboard-form-inline-note dashboard-form-inline-note--warning"
                >
                  {templateRouteWarning}
                </Typography>
              )}
              {prefilledFields.length > 0 && (
                <Typography
                  variant="body2"
                  className="dashboard-form-inline-note"
                >
                  {i18n.t("pages.credentialsManagement.issue.prefill", {
                    count: prefilledFields.length,
                  })}
                </Typography>
              )}
              {!prefilledFields.length && (
                <Typography
                  variant="body2"
                  className="dashboard-form-inline-note"
                >
                  <TipsAndUpdatesOutlinedIcon
                    sx={{ marginRight: "0.45rem", verticalAlign: "text-bottom" }}
                  />
                  Choose a template first, then pick the connection who should
                  receive it.
                </Typography>
              )}
            </Box>

            {selectedTemplate && (
              <Box className="dashboard-form-panel">
                <Box className="dashboard-form-grid dashboard-form-grid--auto-fill">
                  {(selectedTemplate.attributes || []).map((attribute) => (
                    <TextField
                      key={attribute.name}
                      type={
                        attribute.type === "number" || attribute.type === "integer"
                          ? "number"
                          : "text"
                      }
                      label={`${attribute.name}${attribute.required ? " *" : ""}`}
                      value={values[attribute.name] || ""}
                      onChange={(event) =>
                        setValues((currentValue) => ({
                          ...currentValue,
                          [attribute.name]: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  ))}
                </Box>
              </Box>
            )}

            <Stack
              direction={{ xs: "column-reverse", sm: "row" }}
              spacing={1}
              className="dashboard-form-actions"
              justifyContent="flex-end"
            >
              <Button
                variant="contained"
                className="neutral-button"
                onClick={() => navigate(RoutePath.Credentials)}
              >
                {i18n.t("pages.credentialsManagement.issue.cancel")}
              </Button>
              <Button
                variant="contained"
                onClick={submit}
                disabled={!canSubmit || loading}
              >
                {i18n.t("pages.credentialsManagement.issue.submit")}
              </Button>
            </Stack>
          </>
        )}
      </Box>
    </Box>
  );
};

export { IssueCredentialForm };
