import CreateOutlinedIcon from "@mui/icons-material/CreateOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Box,
  Button,
  Paper,
  Stack,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AppTable, useTable } from "../../components/AppTable";
import { AppTableHeader } from "../../components/AppTable/AppTable.types";
import { filter, FilterBar } from "../../components/FilterBar";
import { FilterData } from "../../components/FilterBar/FilterBar.types";
import { PageHeader } from "../../components/PageHeader";
import { PopupModal } from "../../components/PopupModal";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { TemplateService } from "../../services";
import { TemplateDetail as TemplateDetailModel } from "../../services/template.types";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";
import { triggerToast } from "../../utils/toast";

interface TemplateIssuedCredentialRow {
  id: string;
  holderDid: string;
  status: string;
  issuedAt: number;
}

const issuedCredentialHeaders: AppTableHeader<TemplateIssuedCredentialRow>[] = [
  {
    id: "id",
    label: i18n.t("pages.templates.detail.issued.headers.id"),
  },
  {
    id: "holderDid",
    label: i18n.t("pages.templates.detail.issued.headers.holder"),
  },
  {
    id: "status",
    label: i18n.t("pages.templates.detail.issued.headers.status"),
  },
  {
    id: "issuedAt",
    label: i18n.t("pages.templates.detail.issued.headers.issuedAt"),
  },
];

const TemplateDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [template, setTemplate] = useState<TemplateDetailModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterData, setFilterData] = useState<FilterData>({
    startDate: null,
    endDate: null,
    keyword: "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const templateId = String(id || "").trim();

  const fetchTemplateDetail = async () => {
    if (!templateId) {
      triggerToast(i18n.t("pages.templates.messages.invalidTemplate"), "error");
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

  useEffect(() => {
    void fetchTemplateDetail();
  }, [templateId]);

  const rows = useMemo<TemplateIssuedCredentialRow[]>(
    () =>
      (template?.issuedCredentials || []).map((credential) => ({
        id: credential.id,
        holderDid: credential.holderDid,
        status: credential.status,
        issuedAt: new Date(credential.issuedAt).getTime(),
      })),
    [template?.issuedCredentials]
  );

  const filteredRows = filter(rows, filterData, {
    keyword: ["id", "holderDid", "status"],
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

  const removeTemplate = async () => {
    if (!templateId) {
      return;
    }

    try {
      await TemplateService.remove(templateId);
      triggerToast(i18n.t("pages.templates.messages.deleteSuccess"), "success");
      navigate(RoutePath.Templates);
    } catch {
      triggerToast(i18n.t("pages.templates.messages.deleteError"), "error");
    }
  };

  return (
    <Box
      className="template-detail-page"
      sx={{ padding: "0 2.5rem 2.5rem" }}
    >
      <PageHeader
        onBack={() => navigate(RoutePath.Templates)}
        title={template?.name || i18n.t("pages.templates.detail.title")}
        action={
          <Stack
            direction="row"
            spacing={1}
          >
            <Button
              variant="contained"
              startIcon={<SendOutlinedIcon />}
              onClick={() =>
                navigate(
                  `${RoutePath.IssueCredential}?templateId=${encodeURIComponent(templateId)}`
                )
              }
              disabled={!template}
            >
              {i18n.t("pages.templates.actions.issue")}
            </Button>
            <Button
              variant="contained"
              className="neutral-button"
              startIcon={<CreateOutlinedIcon />}
              onClick={() =>
                navigate(RoutePath.TemplateEdit.replace(":id", templateId))
              }
              disabled={!template}
            >
              {i18n.t("pages.templates.actions.edit")}
            </Button>
            <Button
              variant="contained"
              className="neutral-button"
              startIcon={<DeleteOutlineOutlinedIcon />}
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!template}
            >
              {i18n.t("pages.templates.actions.delete")}
            </Button>
          </Stack>
        }
        sx={{
          margin: "1.5rem 0",
        }}
      />

      {template && (
        <Paper
          sx={{
            borderRadius: "1rem",
            padding: "1rem",
            marginBottom: "1rem",
            boxShadow:
              "0.25rem 0.25rem 1.25rem 0 rgba(var(--text-color-rgb), 0.16)",
          }}
        >
          <Stack spacing={1}>
            <Typography variant="body1">
              <strong>{i18n.t("pages.templates.detail.fields.schemaId")}:</strong>{" "}
              {template.schemaId}
            </Typography>
            <Typography variant="body1">
              <strong>{i18n.t("pages.templates.detail.fields.createdAt")}:</strong>{" "}
              {formatDateTime(new Date(template.createdAt))}
            </Typography>
            <Typography variant="body1">
              <strong>{i18n.t("pages.templates.detail.fields.updatedAt")}:</strong>{" "}
              {formatDateTime(new Date(template.updatedAt))}
            </Typography>
            <Typography variant="body1">
              <strong>{i18n.t("pages.templates.detail.fields.attributes")}:</strong>{" "}
              {template.attributes
                .map(
                  (attribute) =>
                    `${attribute.name} (${attribute.type}${attribute.required ? ", required" : ""})`
                )
                .join(", ")}
            </Typography>
          </Stack>
        </Paper>
      )}

      <Typography
        variant="h6"
        marginBottom={1}
      >
        {i18n.t("pages.templates.detail.issued.title", {
          number: template?.issuedCredentials.length || 0,
        })}
      </Typography>
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
              <TableCell>{row.id}</TableCell>
              <TableCell>{row.holderDid}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{formatDate(new Date(row.issuedAt))}</TableCell>
              <TableCell align="left">
                <Button
                  variant="text"
                  startIcon={<VisibilityOutlinedIcon />}
                  onClick={() =>
                    navigate(RoutePath.CredentialDetails.replace(":id", row.id))
                  }
                >
                  {i18n.t("pages.templates.detail.issued.view")}
                </Button>
              </TableCell>
            </TableRow>
          )}
          onRequestSort={handleRequestSort}
          orderBy={orderBy}
          headers={issuedCredentialHeaders}
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
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={i18n.t("pages.templates.delete.title")}
        description={i18n.t("pages.templates.delete.body")}
        footer={
          <>
            <Button
              variant="contained"
              className="neutral-button"
              onClick={() => setShowDeleteConfirm(false)}
            >
              {i18n.t("pages.templates.delete.cancel")}
            </Button>
            <Button
              variant="contained"
              onClick={removeTemplate}
              disabled={loading}
            >
              {i18n.t("pages.templates.delete.confirm")}
            </Button>
          </>
        }
      />
    </Box>
  );
};

export { TemplateDetail };
