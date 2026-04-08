import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import CreateOutlinedIcon from "@mui/icons-material/CreateOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreVert from "@mui/icons-material/MoreVert";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Box,
  Button,
  IconButton,
  Paper,
  TableCell,
  TableRow,
  Tooltip,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
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
import { TemplateService } from "../../services";
import { CredentialTemplate } from "../../services/template.types";
import { formatDate } from "../../utils/dateFormatter";
import { triggerToast } from "../../utils/toast";

interface TemplateRow {
  id: string;
  name: string;
  schemaId: string;
  autoIssue: boolean;
  attributes: number;
  createdAt: number;
}

const headers: AppTableHeader<TemplateRow>[] = [
  {
    id: "name",
    label: i18n.t("pages.templates.table.headers.name"),
  },
  {
    id: "schemaId",
    label: i18n.t("pages.templates.table.headers.schemaId"),
  },
  {
    id: "attributes",
    label: i18n.t("pages.templates.table.headers.attributes"),
  },
  {
    id: "autoIssue",
    label: i18n.t("pages.templates.table.headers.autoIssue"),
  },
  {
    id: "createdAt",
    label: i18n.t("pages.templates.table.headers.createdAt"),
  },
];

const TemplatesList = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<CredentialTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterData, setFilterData] = useState<FilterData>({
    startDate: null,
    endDate: null,
    keyword: "",
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const list = await TemplateService.list();
      setTemplates(list);
    } catch {
      triggerToast(i18n.t("pages.templates.messages.fetchError"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const rows = useMemo<TemplateRow[]>(
    () =>
      templates.map((template) => ({
        id: template.id,
        name: template.name,
        schemaId: template.schemaId,
        autoIssue: Boolean(template.autoIssue),
        attributes: template.attributes.length,
        createdAt: new Date(template.createdAt).getTime(),
      })),
    [templates]
  );

  const filteredRows = filter(rows, filterData, {
    keyword: ["name", "schemaId"],
    date: "createdAt",
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
  } = useTable(filteredRows, "createdAt");

  const deleteTemplate = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await TemplateService.remove(deleteId);
      triggerToast(i18n.t("pages.templates.messages.deleteSuccess"), "success");
      setDeleteId(null);
      await fetchTemplates();
    } catch {
      triggerToast(i18n.t("pages.templates.messages.deleteError"), "error");
    }
  };

  return (
    <Box
      className="templates-page"
      sx={{
        padding: {
          xs: "0 1rem 1.5rem",
          sm: "0 1.5rem 2rem",
          lg: "0 2.5rem 2.5rem",
        },
      }}
    >
      <PageHeader
        title={i18n.t("pages.templates.title", { number: templates.length })}
        action={
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineOutlinedIcon />}
            onClick={() => navigate(RoutePath.TemplateCreate)}
            sx={{
              width: { xs: "100%", sm: "auto" },
            }}
          >
            {i18n.t("pages.templates.actions.create")}
          </Button>
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
              className="table-row"
            >
              <TableCell>{row.name}</TableCell>
              <TableCell>
                <Tooltip
                  title={row.schemaId}
                  placement="top"
                >
                  <span>{row.schemaId}</span>
                </Tooltip>
              </TableCell>
              <TableCell>{row.attributes}</TableCell>
              <TableCell>
                {row.autoIssue ? "Yes" : "No"}
              </TableCell>
              <TableCell>{formatDate(new Date(row.createdAt))}</TableCell>
              <TableCell align="left">
                <DropdownMenu
                  button={
                    <Tooltip
                      title={i18n.t("pages.templates.actions.menu")}
                      placement="top"
                    >
                      <IconButton aria-label="actions">
                        <MoreVert />
                      </IconButton>
                    </Tooltip>
                  }
                  menuItems={[
                    {
                      label: i18n.t("pages.templates.actions.view"),
                      action: () =>
                        navigate(RoutePath.TemplateDetail.replace(":id", row.id)),
                      icon: <VisibilityOutlinedIcon />,
                      className: "icon-left",
                    },
                    {
                      label: i18n.t("pages.templates.actions.edit"),
                      action: () =>
                        navigate(RoutePath.TemplateEdit.replace(":id", row.id)),
                      icon: <CreateOutlinedIcon />,
                      className: "icon-left",
                    },
                    {
                      className: "divider",
                    },
                    {
                      label: i18n.t("pages.templates.actions.issue"),
                      action: () =>
                        navigate(
                          `${RoutePath.IssueCredential}?templateId=${encodeURIComponent(row.id)}`
                        ),
                      icon: <SendOutlinedIcon />,
                      className: "icon-left",
                    },
                    {
                      label: i18n.t("pages.templates.actions.delete"),
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
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title={i18n.t("pages.templates.delete.title")}
        description={i18n.t("pages.templates.delete.body")}
        footer={
          <>
            <Button
              variant="contained"
              className="neutral-button"
              onClick={() => setDeleteId(null)}
            >
              {i18n.t("pages.templates.delete.cancel")}
            </Button>
            <Button
              variant="contained"
              onClick={deleteTemplate}
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

export { TemplatesList };
