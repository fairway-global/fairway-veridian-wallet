import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PageHeader } from "../../components/PageHeader";
import { i18n } from "../../i18n";
import { AppDispatch, RootState } from "../../store";
import { fetchContacts } from "../../store/reducers/connectionsSlice";
import { AddConnectionModal } from "./components/AddConnectionModal";
import { ConnectionsTable } from "./components/ConnectionsTable";
import "./Connections.scss";

const Connections = () => {
  const dispatch = useDispatch<AppDispatch>();
  const contacts = useSelector(
    (state: RootState) => state.connections.contacts
  );
  const [openModal, setOpenModal] = useState(false);

  const handleClick = () => {
    setOpenModal(true);
  };

  const handleGetContacts = async () => {
    await dispatch(fetchContacts());
  };

  return (
    <Box
      className="connections-page"
      sx={{ padding: "0 2.5rem 2.5rem" }}
    >
      <PageHeader
        title={i18n.t("navbar.connections")}
        sx={{
          margin: "1.5rem 0 1rem",
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

      <Box className="connections-intro-card">
        <Typography className="connections-intro-kicker">
          Contact directory
        </Typography>
        <Typography className="connections-intro-title">
          Manage your active relationships in one focused workspace.
        </Typography>
        <Typography className="connections-intro-copy">
          Review established contacts, launch connection actions, and keep the table workflow fast without the extra dashboard cards mixed in.
        </Typography>
        <Typography className="connections-intro-meta">
          {i18n.t("pages.connections.title", {
            number: contacts.length,
          })}
        </Typography>
      </Box>

      <Box className="connections-table-shell">
        <ConnectionsTable />
      </Box>

      <AddConnectionModal
        openModal={openModal}
        setOpenModal={setOpenModal}
        handleGetContacts={handleGetContacts}
      />
    </Box>
  );
};

export { Connections };
