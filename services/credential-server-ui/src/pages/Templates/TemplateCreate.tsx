import { Box } from "@mui/material";
import { useNavigate } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { TemplateService } from "../../services";
import { TemplateUpsertInput } from "../../services/template.types";
import { triggerToast } from "../../utils/toast";
import { TemplateForm } from "./TemplateForm";

const TemplateCreate = () => {
  const navigate = useNavigate();

  const submit = async (value: TemplateUpsertInput) => {
    try {
      await TemplateService.create(value);
      triggerToast(i18n.t("pages.templates.messages.createSuccess"), "success");
      navigate(RoutePath.Templates);
    } catch {
      triggerToast(i18n.t("pages.templates.messages.createError"), "error");
    }
  };

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
        onBack={() => navigate(RoutePath.Templates)}
        title={i18n.t("pages.templates.create.title")}
        sx={{
          margin: {
            xs: "1rem 0",
            md: "1.5rem 0",
          },
        }}
      />
      <TemplateForm
        submitLabel={i18n.t("pages.templates.create.submit")}
        onSubmit={submit}
        onCancel={() => navigate(RoutePath.Templates)}
      />
    </Box>
  );
};

export { TemplateCreate };
