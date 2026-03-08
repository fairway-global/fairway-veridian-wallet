import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { TemplateService } from "../../services";
import { CredentialTemplate, TemplateUpsertInput } from "../../services/template.types";
import { triggerToast } from "../../utils/toast";
import { TemplateForm } from "./TemplateForm";
import { TemplateFormState } from "./Templates.types";

const TemplateEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const templateId = String(id || "").trim();
  const [template, setTemplate] = useState<CredentialTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!templateId) {
        navigate(RoutePath.Templates);
        return;
      }

      try {
        setLoading(true);
        const detail = await TemplateService.detail(templateId);
        setTemplate(detail);
      } catch {
        triggerToast(i18n.t("pages.templates.messages.fetchError"), "error");
        navigate(RoutePath.Templates);
      } finally {
        setLoading(false);
      }
    };

    void fetchTemplate();
  }, [templateId]);

  const submit = async (value: TemplateUpsertInput) => {
    try {
      await TemplateService.update(templateId, value);
      triggerToast(i18n.t("pages.templates.messages.updateSuccess"), "success");
      navigate(RoutePath.TemplateDetail.replace(":id", templateId));
    } catch {
      triggerToast(i18n.t("pages.templates.messages.updateError"), "error");
    }
  };

  if (!template) {
    return (
      <Box sx={{ padding: "0 2.5rem 2.5rem" }}>
        <PageHeader
          onBack={() => navigate(RoutePath.Templates)}
          title={i18n.t("pages.templates.edit.title")}
          sx={{ margin: "1.5rem 0" }}
        />
      </Box>
    );
  }

  const initialValue: TemplateFormState = {
    name: template.name,
    schemaId: template.schemaId,
    attributes: template.attributes,
    autoIssue: Boolean(template.autoIssue),
  };

  return (
    <Box sx={{ padding: "0 2.5rem 2.5rem" }}>
      <PageHeader
        onBack={() => navigate(RoutePath.TemplateDetail.replace(":id", templateId))}
        title={i18n.t("pages.templates.edit.title")}
        sx={{ margin: "1.5rem 0" }}
      />
      <TemplateForm
        initialValue={initialValue}
        loading={loading}
        submitLabel={i18n.t("pages.templates.edit.submit")}
        onSubmit={submit}
        onCancel={() => navigate(RoutePath.TemplateDetail.replace(":id", templateId))}
      />
    </Box>
  );
};

export { TemplateEdit };
