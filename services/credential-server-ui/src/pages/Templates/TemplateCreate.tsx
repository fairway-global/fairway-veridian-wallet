import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";
import { Box, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { TemplateService } from "../../services";
import { TemplateUpsertInput } from "../../services/template.types";
import { triggerToast } from "../../utils/toast";
import { TemplateForm } from "./TemplateForm";
import "../../styles/dashboardForms.scss";

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
      <Box className="dashboard-form-tip-grid">
        <Box className="dashboard-form-tip-card dashboard-form-tip-card--hero">
          <Box className="dashboard-form-tip-badge">
            Guided setup
          </Box>
          <Typography className="dashboard-form-tip-title">
            Create a template your team can issue confidently.
          </Typography>
          <Typography className="dashboard-form-tip-description">
            Start with a recognizable name, choose whether the schema should be
            reusable, then mark only the fields that are truly required during
            issuance.
          </Typography>
        </Box>
        <Box className="dashboard-form-tip-card">
          <Box className="dashboard-form-tip-badge">
            Quick checks
          </Box>
          <Box className="dashboard-form-tip-list">
            <Box className="dashboard-form-tip-item">
              <CheckCircleOutlineRoundedIcon />
              <span>Name the template how issuers will recognize it later.</span>
            </Box>
            <Box className="dashboard-form-tip-item">
              <CheckCircleOutlineRoundedIcon />
              <span>Use public schemas only when other issuers should reuse them.</span>
            </Box>
            <Box className="dashboard-form-tip-item">
              <RuleFolderOutlinedIcon />
              <span>Required fields should be the minimum needed to issue safely.</span>
            </Box>
          </Box>
        </Box>
      </Box>
      <TemplateForm
        submitLabel={i18n.t("pages.templates.create.submit")}
        onSubmit={submit}
        onCancel={() => navigate(RoutePath.Templates)}
      />
    </Box>
  );
};

export { TemplateCreate };
