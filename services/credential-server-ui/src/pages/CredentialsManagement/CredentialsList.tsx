import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DoDisturbOnOutlinedIcon from "@mui/icons-material/DoDisturbOnOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import MoreVert from "@mui/icons-material/MoreVert";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import axios from "axios";
import {
  Box,
  Button,
  IconButton,
  Paper,
  TableCell,
  TableRow,
  Tooltip,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppTable, useTable } from "../../components/AppTable";
import { AppTableHeader } from "../../components/AppTable/AppTable.types";
import { DropdownMenu } from "../../components/DropdownMenu";
import { filter, FilterBar } from "../../components/FilterBar";
import { FilterData } from "../../components/FilterBar/FilterBar.types";
import { PageHeader } from "../../components/PageHeader";
import { PopupModal } from "../../components/PopupModal";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { ManagedCredentialService } from "../../services";
import { ManagedCredential } from "../../services/template.types";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";
import { triggerToast } from "../../utils/toast";

interface CredentialRow {
  id: string;
  templateName: string;
  holderDid: string;
  status: string;
  issuedAt: number;
}

interface ApiErrorResponse {
  error?: string | null;
  data?: unknown;
}

const headers: AppTableHeader<CredentialRow>[] = [
  {
    id: "templateName",
    label: i18n.t("pages.credentialsManagement.table.headers.template"),
  },
  {
    id: "holderDid",
    label: i18n.t("pages.credentialsManagement.table.headers.holder"),
  },
  {
    id: "status",
    label: i18n.t("pages.credentialsManagement.table.headers.status"),
  },
  {
    id: "issuedAt",
    label: i18n.t("pages.credentialsManagement.table.headers.issuedAt"),
  },
];

const CredentialsList = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<ManagedCredential[]>([]);
  const [filterData, setFilterData] = useState<FilterData>({
    startDate: null,
    endDate: null,
    keyword: "",
  });
  const [loading, setLoading] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getDeleteErrorMessage = (error: unknown): string => {
    const fallback = i18n.t("pages.credentialsManagement.messages.deleteError");

    if (!axios.isAxiosError(error)) {
      return fallback;
    }

    const status = error.response?.status;
    const payload = error.response?.data as ApiErrorResponse | undefined;
    const payloadError = String(payload?.error || payload?.data || "").trim();

    if (
      status === 409 ||
      /must be revoked before it can be deleted/i.test(payloadError)
    ) {
      return i18n.t("pages.credentialsManagement.messages.deleteRequiresRevocation");
    }

    return payloadError || fallback;
  };

  const fetchCredentials = useCallback(async () => {
    try {
      setLoading(true);
      const list = await ManagedCredentialService.list();
      setCredentials(list);
    } catch {
      triggerToast(
        i18n.t("pages.credentialsManagement.messages.fetchError"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCredentials();
  }, [fetchCredentials]);

  useEffect(() => {
    const refreshHandler = () => {
      void fetchCredentials();
    };

    window.addEventListener("dashboard:credentials-refresh", refreshHandler);
    return () => {
      window.removeEventListener(
        "dashboard:credentials-refresh",
        refreshHandler
      );
    };
  }, [fetchCredentials]);

  const rows = useMemo<CredentialRow[]>(
    () =>
      credentials.map((credential) => ({
        id: credential.id,
        templateName: credential.templateName || credential.templateId,
        holderDid: credential.holderDid,
        status: credential.status,
        issuedAt: new Date(credential.issuedAt).getTime(),
      })),
    [credentials]
  );

  const filteredRows = filter(rows, filterData, {
    keyword: ["id", "holderDid", "status", "templateName"],
    date: "issuedAt",
  });

  const {
    order,
    orderBy,
    page,
    rowsPerPage,
    handleRequestSort,
    handleChangePage,
    handleChangeRowsPerPage,
    visibleRows,
  } = useTable(filteredRows, "issuedAt");

  const revokeCredential = async () => {
    if (!revokeId) {
      return;
    }

    try {
      await ManagedCredentialService.revoke(revokeId);
      triggerToast(
        i18n.t("pages.credentialsManagement.messages.revokeSuccess"),
        "success"
      );
      setRevokeId(null);
      await fetchCredentials();
    } catch {
      triggerToast(
        i18n.t("pages.credentialsManagement.messages.revokeError"),
        "error"
      );
    }
  };

  const deleteCredential = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await ManagedCredentialService.remove(deleteId);
      triggerToast(
        i18n.t("pages.credentialsManagement.messages.deleteSuccess"),
        "success"
      );
      setDeleteId(null);
      await fetchCredentials();
    } catch (error) {
      triggerToast(getDeleteErrorMessage(error), "error");
    }
  };

  const exportCsv = () => {
    const header = ["credentialId", "templateName", "holderDid", "status", "issuedAt"];
    const lines = rows.map((row) => [
      row.id,
      row.templateName,
      row.holderDid,
      row.status,
      new Date(row.issuedAt).toISOString(),
    ]);
    const csv = [header, ...lines]
      .map((line) =>
        line
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "issued-credentials.csv";
    link.click();
    URL.revokeObjectURL(url);
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
        title={i18n.t("pages.credentialsManagement.title", {
          number: credentials.length,
        })}
        action={
          <Box
            display="flex"
            gap={1}
            sx={{
              flexWrap: { xs: "wrap", sm: "nowrap" },
              width: { xs: "100%", sm: "auto" },
              "& > .MuiButton-root": {
                flex: { xs: "1 1 100%", sm: "0 0 auto" },
              },
            }}
          >
            <Button
              variant="contained"
              className="neutral-button"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={exportCsv}
              disabled={!rows.length}
            >
              {i18n.t("pages.credentialsManagement.actions.export")}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineOutlinedIcon />}
              onClick={() => navigate(RoutePath.IssueCredential)}
            >
              {i18n.t("pages.credentialsManagement.actions.issue")}
            </Button>
          </Box>
        }
        sx={{
          margin: {
            xs: "1rem 0",
            md: "1.5rem 0",
          },
        }}
      />
      <FilterBar
        onChange={setFilterData}
        totalFound={filteredRows.length}
      />
      <Paper
        sx={{
          borderRadius: "1rem",
          overflow: "hidden",
          boxShadow:
            "0.25rem 0.25rem 1.25rem 0 rgba(var(--text-color-rgb), 0.16)",
          flex: 1,
        }}
      >
        <AppTable
          order={order}
          rows={visibleRows}
          onRenderRow={(row) => (
            <TableRow
              key={row.id}
              hover
            >
              <TableCell>{row.templateName}</TableCell>
              <TableCell>
                <Tooltip
                  title={row.holderDid}
                  placement="top"
                >
                  <span>{row.holderDid}</span>
                </Tooltip>
              </TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>
                <Tooltip
                  title={formatDateTime(new Date(row.issuedAt))}
                  placement="top"
                >
                  <span>{formatDate(new Date(row.issuedAt))}</span>
                </Tooltip>
              </TableCell>
              <TableCell align="left">
                <DropdownMenu
                  button={
                    <Tooltip
                      title={i18n.t("pages.credentialsManagement.actions.menu")}
                      placement="top"
                    >
                      <IconButton aria-label="actions">
                        <MoreVert />
                      </IconButton>
                    </Tooltip>
                  }
                  menuItems={[
                    {
                      label: i18n.t("pages.credentialsManagement.actions.view"),
                      action: () =>
                        navigate(RoutePath.CredentialDetails.replace(":id", row.id)),
                      icon: <VisibilityOutlinedIcon />,
                      className: "icon-left",
                    },
                    {
                      label: i18n.t("pages.credentialsManagement.actions.revoke"),
                      action: () => setRevokeId(row.id),
                      icon: <DoDisturbOnOutlinedIcon />,
                      className: "icon-left",
                      disabled: row.status !== "issued",
                    },
                    {
                      label: i18n.t("pages.credentialsManagement.actions.delete"),
                      action: () => setDeleteId(row.id),
                      icon: <DeleteOutlineOutlinedIcon />,
                      className: "icon-left action-delete",
                    },
                  ]}
                />
              </TableCell>
            </TableRow>
          )}
          onRequestSort={handleRequestSort}
          orderBy={orderBy}
          headers={headers}
          pagination={{
            component: "div",
            count: filteredRows.length,
            rowsPerPage: rowsPerPage,
            page: page,
            onPageChange: handleChangePage,
            onRowsPerPageChange: handleChangeRowsPerPage,
          }}
        />
      </Paper>

      <PopupModal
        open={Boolean(revokeId)}
        onClose={() => setRevokeId(null)}
        title={i18n.t("pages.credentialsManagement.revoke.title")}
        description={i18n.t("pages.credentialsManagement.revoke.body")}
        footer={
          <>
            <Button
              variant="contained"
              className="neutral-button"
              onClick={() => setRevokeId(null)}
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
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title={i18n.t("pages.credentialsManagement.delete.title")}
        description={i18n.t("pages.credentialsManagement.delete.body")}
        footer={
          <>
            <Button
              variant="contained"
              className="neutral-button"
              onClick={() => setDeleteId(null)}
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

export { CredentialsList };
