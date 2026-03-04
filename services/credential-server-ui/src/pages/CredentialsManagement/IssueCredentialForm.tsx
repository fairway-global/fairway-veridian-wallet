import { Box, Button, MenuItem, Stack, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { ContactService, ManagedCredentialService, TemplateService } from "../../services";
import { CredentialTemplate } from "../../services/template.types";
import { triggerToast } from "../../utils/toast";

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
  const [loading, setLoading] = useState(false);

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

        if (!templateId && templateList.length) {
          setTemplateId(templateList[0].id);
        }
      } catch {
        triggerToast(i18n.t("pages.credentialsManagement.messages.fetchError"), "error");
      } finally {
        setLoading(false);
      }
    };

    void fetchDependencies();
  }, []);

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

  return (
    <Box sx={{ padding: "0 2.5rem 2.5rem" }}>
      <PageHeader
        onBack={() => navigate(RoutePath.Credentials)}
        title={i18n.t("pages.credentialsManagement.issue.title")}
        sx={{ margin: "1.5rem 0" }}
      />
      <Stack spacing={2}>
        <TextField
          select
          label={i18n.t("pages.credentialsManagement.issue.template")}
          value={templateId}
          onChange={(event) => {
            setTemplateId(event.target.value);
            setValues({});
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
          onChange={(event) => setConnectionId(event.target.value)}
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
        {(selectedTemplate?.attributes || []).map((attribute) => (
          <TextField
            key={attribute.name}
            type={attribute.type === "number" || attribute.type === "integer" ? "number" : "text"}
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
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        marginTop={2}
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
    </Box>
  );
};

export { IssueCredentialForm };
