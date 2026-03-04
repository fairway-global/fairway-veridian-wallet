import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { RoleIndex } from "../../components/NavBar/constants/roles";
import { PageHeader } from "../../components/PageHeader";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { TemplateService } from "../../services";
import { CredentialTemplate } from "../../services/template.types";
import { AppDispatch, RootState } from "../../store";
import { fetchContacts } from "../../store/reducers/connectionsSlice";
import { triggerToast } from "../../utils/toast";
import { AddConnectionModal } from "./components/AddConnectionModal";
import { ConnectionsTable } from "./components/ConnectionsTable";
import "./Connections.scss";

const Connections = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const contacts = useSelector(
    (state: RootState) => state.connections.contacts
  );
  const roleView = useSelector((state: RootState) => state.stateCache.roleView);
  const [templates, setTemplates] = useState<CredentialTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    if (roleView !== RoleIndex.ISSUER) {
      return;
    }

    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const templatesList = await TemplateService.list();
        setTemplates(templatesList);
      } catch {
        triggerToast(i18n.t("pages.templates.messages.fetchError"), "error");
      } finally {
        setLoadingTemplates(false);
      }
    };

    void fetchTemplates();
  }, [roleView]);

  const handleClick = () => {
    setOpenModal(true);
  };

  const handleGetContacts = () => {
    dispatch(fetchContacts());
  };

  return (
    <Box
      className="connections-page"
      sx={{ padding: "0 2.5rem 2.5rem" }}
    >
      <PageHeader
        title={`${i18n.t("pages.connections.title", {
          number: contacts.length,
        })}`}
        sx={{
          margin: "1.5rem 0",
        }}
        action={
          <Button
            className="add-connection-button primary-button"
            aria-haspopup="true"
            variant="contained"
            disableElevation
            disableRipple
            onClick={handleClick}
            startIcon={<AddIcon />}
          >
            {i18n.t("pages.connections.addConnection.title")}
          </Button>
        }
      />
      <AddConnectionModal
        openModal={openModal}
        setOpenModal={setOpenModal}
        handleGetContacts={handleGetContacts}
      />
      <ConnectionsTable />
      {roleView === RoleIndex.ISSUER && (
        <Paper className="dashboard-templates-summary">
          <Box className="dashboard-templates-summary-header">
            <Typography variant="h6">
              {i18n.t("pages.connections.dashboardTemplates.title", {
                number: templates.length,
              })}
            </Typography>
            <Button
              variant="text"
              onClick={() => navigate(RoutePath.Templates)}
            >
              {i18n.t("pages.connections.dashboardTemplates.viewAll")}
            </Button>
          </Box>
          {loadingTemplates ? (
            <Typography>
              {i18n.t("pages.connections.dashboardTemplates.loading")}
            </Typography>
          ) : templates.length ? (
            <Stack spacing={1}>
              {templates.slice(0, 5).map((template) => (
                <Box
                  key={template.id}
                  className="dashboard-template-item"
                >
                  <Typography className="name">{template.name}</Typography>
                  <Typography className="schema-id">
                    {i18n.t("pages.connections.dashboardTemplates.schema")}:{" "}
                    {template.schemaId}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography>
              {i18n.t("pages.connections.dashboardTemplates.empty")}
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  );
};

export { Connections };
