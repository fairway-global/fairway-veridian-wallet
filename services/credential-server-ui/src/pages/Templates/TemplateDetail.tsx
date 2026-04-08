import CreateOutlinedIcon from "@mui/icons-material/CreateOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
import { useSchemaDetail } from "../../hooks/SchemaDetail";
import { i18n } from "../../i18n";
import { TemplateService } from "../../services";
import { TemplateDetail as TemplateDetailModel } from "../../services/template.types";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";
import {
  formatSchemaAttributeLabel,
  getSchemaAttributeDefinitions,
} from "../../utils/schemaAttributes";
import { triggerToast } from "../../utils/toast";
import { getTemplateAttributeTypeLabel } from "./attributeTypeLabels";

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

function getIssuedCredentialStatusStyles(status: string) {
  switch (status) {
    case "revoked":
      return {
        backgroundColor: "var(--color-error-100)",
        color: "var(--color-error-800)",
      };
    case "deleted":
      return {
        backgroundColor: "var(--color-neutral-200)",
        color: "var(--color-neutral-700)",
      };
    case "issued":
    default:
      return {
        backgroundColor: "var(--color-success-100)",
        color: "var(--color-success-900)",
      };
  }
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Box>
      <Typography
        variant="body2"
        sx={{ color: "var(--color-neutral-600)", marginBottom: 0.5 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: "var(--text-color)",
          fontWeight: 600,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

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
  const schemaDetail = useSchemaDetail(template?.schemaId);

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

  const schemaAttributes = useMemo(
    () => getSchemaAttributeDefinitions(schemaDetail),
    [schemaDetail]
  );

  const templateAttributes = useMemo(() => {
    const schemaAttributeByName = new Map(
      schemaAttributes.map((attribute) => [attribute.name, attribute])
    );

    return (template?.attributes || []).map((attribute) => {
      const schemaAttribute = schemaAttributeByName.get(attribute.name);

      return {
        name: attribute.name,
        label:
          schemaAttribute?.label ||
          formatSchemaAttributeLabel(attribute.name) ||
          attribute.name,
        description: schemaAttribute?.description || "",
        type: schemaAttribute?.type || attribute.type,
        required: attribute.required,
      };
    });
  }, [schemaAttributes, template?.attributes]);

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

      {loading && !template ? (
        <Box
          sx={{
            minHeight: "50vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress />
        </Box>
      ) : null}

      {template && (
        <Stack spacing={2}>
          <Paper
            sx={{
              borderRadius: "1rem",
              overflow: "hidden",
              boxShadow:
                "0.25rem 0.25rem 1.25rem 0 rgba(var(--text-color-rgb), 0.16)",
            }}
          >
            <Box
              sx={{
                padding: { xs: "1.5rem", md: "2rem" },
                background:
                  "linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.08) 0%, rgba(var(--color-success-rgb), 0.10) 100%)",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ color: "var(--color-neutral-700)" }}
                  >
                    {i18n.t("pages.templates.detail.kicker")}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: "var(--text-color)",
                      fontWeight: 700,
                      marginTop: 0.5,
                    }}
                  >
                    {template.name}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: "var(--color-neutral-700)",
                      marginTop: 1,
                    }}
                  >
                    {schemaDetail?.title || template.schemaId}
                  </Typography>
                  {schemaDetail?.description && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "var(--color-neutral-600)",
                        marginTop: 1,
                        maxWidth: "48rem",
                      }}
                    >
                      {schemaDetail.description}
                    </Typography>
                  )}
                </Box>

                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Chip
                    label={i18n.t(
                      template.autoIssue
                        ? "pages.templates.detail.badges.autoIssueOn"
                        : "pages.templates.detail.badges.autoIssueOff"
                    )}
                    sx={{
                      backgroundColor: template.autoIssue
                        ? "var(--color-success-100)"
                        : "var(--color-neutral-200)",
                      color: template.autoIssue
                        ? "var(--color-success-900)"
                        : "var(--color-neutral-700)",
                      fontWeight: 700,
                    }}
                  />
                  <Chip
                    label={i18n.t("pages.templates.detail.badges.attributes", {
                      number: templateAttributes.length,
                    })}
                    sx={{
                      backgroundColor: "rgba(var(--text-color-rgb), 0.08)",
                      color: "var(--text-color)",
                      fontWeight: 700,
                    }}
                  />
                </Stack>
              </Stack>
            </Box>

            <Stack divider={<Divider />}>
              <Box sx={{ padding: { xs: "1.5rem", md: "2rem" } }}>
                <Typography
                  variant="h6"
                  sx={{ marginBottom: 2, fontWeight: 700 }}
                >
                  {i18n.t("pages.templates.detail.summary")}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 2,
                  }}
                >
                  <DetailItem
                    label={i18n.t("pages.templates.detail.fields.id")}
                    value={template.id}
                  />
                  <DetailItem
                    label={i18n.t("pages.templates.detail.fields.schemaId")}
                    value={template.schemaId}
                  />
                  <DetailItem
                    label={i18n.t("pages.templates.detail.fields.createdAt")}
                    value={formatDateTime(new Date(template.createdAt))}
                  />
                  <DetailItem
                    label={i18n.t("pages.templates.detail.fields.updatedAt")}
                    value={formatDateTime(new Date(template.updatedAt))}
                  />
                  <DetailItem
                    label={i18n.t("pages.templates.detail.fields.autoIssue")}
                    value={template.autoIssue ? "Yes" : "No"}
                  />
                  <DetailItem
                    label={i18n.t("pages.templates.detail.fields.issuedCount")}
                    value={String(template.issuedCredentials.length)}
                  />
                </Box>
              </Box>

              <Box sx={{ padding: { xs: "1.5rem", md: "2rem" } }}>
                <Typography
                  variant="h6"
                  sx={{ marginBottom: 1, fontWeight: 700 }}
                >
                  {i18n.t("pages.templates.detail.attributesTitle")}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "var(--color-neutral-600)",
                    marginBottom: 2,
                  }}
                >
                  {i18n.t("pages.templates.detail.attributesDescription")}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 2,
                  }}
                >
                  {templateAttributes.map((attribute) => (
                    <Box
                      key={attribute.name}
                      sx={{
                        borderRadius: "1rem",
                        border: "1px solid rgba(var(--text-color-rgb), 0.08)",
                        background: "var(--color-neutral-100)",
                        padding: "1rem",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        flexWrap="wrap"
                        sx={{ marginBottom: 1 }}
                      >
                        <Chip
                          size="small"
                          label={getTemplateAttributeTypeLabel(attribute.type)}
                          sx={{
                            backgroundColor: "rgba(var(--text-color-rgb), 0.08)",
                            color: "var(--text-color)",
                          }}
                        />
                        {attribute.required && (
                          <Chip
                            size="small"
                            label={i18n.t("pages.templates.detail.required")}
                            sx={{
                              backgroundColor: "var(--color-success-100)",
                              color: "var(--color-success-900)",
                              fontWeight: 700,
                            }}
                          />
                        )}
                      </Stack>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          color: "var(--text-color)",
                          fontWeight: 700,
                          marginBottom: 0.5,
                        }}
                      >
                        {attribute.label}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "var(--color-neutral-600)",
                          fontFamily: "monospace",
                          marginBottom: attribute.description ? 0.75 : 0,
                        }}
                      >
                        {attribute.name}
                      </Typography>
                      {attribute.description && (
                        <Typography
                          variant="body2"
                          sx={{ color: "var(--color-neutral-700)" }}
                        >
                          {attribute.description}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
                {!templateAttributes.length && (
                  <Typography
                    variant="body2"
                    sx={{ color: "var(--color-neutral-600)" }}
                  >
                    {i18n.t("pages.templates.detail.emptyAttributes")}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>

          <Box>
            <Typography
              variant="h6"
              marginBottom={1}
              sx={{ fontWeight: 700 }}
            >
              {i18n.t("pages.templates.detail.issued.title", {
                number: template.issuedCredentials.length,
              })}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "var(--color-neutral-600)",
                marginBottom: 2,
              }}
            >
              {i18n.t("pages.templates.detail.issued.description")}
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
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, overflowWrap: "anywhere" }}
                      >
                        {row.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ overflowWrap: "anywhere" }}
                      >
                        {row.holderDid}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.status}
                        sx={{
                          ...getIssuedCredentialStatusStyles(row.status),
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      />
                    </TableCell>
                    <TableCell>{formatDate(new Date(row.issuedAt))}</TableCell>
                    <TableCell align="left">
                      <Button
                        variant="text"
                        startIcon={<VisibilityOutlinedIcon />}
                        onClick={() =>
                          navigate(
                            RoutePath.CredentialDetails.replace(":id", row.id)
                          )
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
          </Box>
        </Stack>
      )}

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
