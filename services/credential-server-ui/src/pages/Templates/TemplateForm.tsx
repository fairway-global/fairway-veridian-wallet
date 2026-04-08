import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { IGNORE_ATTRIBUTES } from "../../const";
import { useSchemaDetail } from "../../hooks/SchemaDetail";
import { i18n } from "../../i18n";
import {
  TemplateAttribute,
  TemplateAttributeType,
} from "../../services/template.types";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchSchemas } from "../../store/reducers/schemasSlice";
import { triggerToast } from "../../utils/toast";
import { TemplateFormProps, TemplateFormState } from "./Templates.types";
import { getTemplateAttributeTypeLabel } from "./attributeTypeLabels";
import "../../styles/dashboardForms.scss";

const TEMPLATE_ATTRIBUTE_TYPES: TemplateAttributeType[] = [
  "string",
  "integer",
  "number",
  "boolean",
];
const TEMPLATE_ATTRIBUTE_TYPES_SET = new Set(TEMPLATE_ATTRIBUTE_TYPES);

const defaultTemplateState: TemplateFormState = {
  name: "",
  schemaId: "",
  attributes: [],
  autoIssue: false,
  schemaPublic: false,
};

const TemplateForm = ({
  initialValue,
  loading,
  submitLabel,
  onSubmit,
  onCancel,
}: TemplateFormProps) => {
  const dispatch = useAppDispatch();
  const schemas = useAppSelector((state) => state.schemasCache.schemas);
  const isCreateMode = !initialValue;
  const [form, setForm] = useState<TemplateFormState>(
    initialValue || defaultTemplateState
  );
  const [autoFilledSchemaId, setAutoFilledSchemaId] = useState<string | null>(
    null
  );
  const [hasInitializedSchemaVisibility, setHasInitializedSchemaVisibility] =
    useState(!Boolean(initialValue?.schemaId));
  const normalizedSchemas = useMemo(
    () =>
      schemas
        .map((schema) => ({
          id: String(schema.id || "").trim(),
          name: String(schema.name || "").trim(),
          isPublic: Boolean(schema.isPublic),
          ownedByCurrentIssuer: Boolean(schema.ownedByCurrentIssuer),
          canManageVisibility: Boolean(schema.canManageVisibility),
        }))
        .filter((schema) => schema.id),
    [schemas]
  );
  const selectableSchemas = useMemo(
    () =>
      normalizedSchemas.filter(
        (schema) =>
          schema.isPublic || Boolean(initialValue?.schemaId === schema.id)
      ),
    [initialValue?.schemaId, normalizedSchemas]
  );
  const hasSchemaId = Boolean(form.schemaId.trim());
  const schemaDetail = useSchemaDetail(hasSchemaId ? form.schemaId : undefined);
  const selectedSchema = useMemo(
    () =>
      normalizedSchemas.find((schema) => schema.id === form.schemaId) || null,
    [form.schemaId, normalizedSchemas]
  );
  const isKnownSchemaId = useMemo(
    () =>
      !hasSchemaId ||
      selectableSchemas.some((schema) => schema.id === form.schemaId) ||
      Boolean(initialValue?.schemaId === form.schemaId),
    [form.schemaId, hasSchemaId, initialValue?.schemaId, selectableSchemas]
  );

  const schemaAttributes = useMemo<TemplateAttribute[]>(() => {
    const attributeSchema = schemaDetail?.properties?.a?.oneOf?.[1];
    const properties = (attributeSchema?.properties || {}) as Record<
      string,
      { type?: string }
    >;
    const requiredFields = new Set(attributeSchema?.required || []);

    return Object.keys(properties)
      .filter((attributeName) => !IGNORE_ATTRIBUTES.includes(attributeName))
      .map((attributeName) => {
        const attributeType = String(properties[attributeName]?.type || "string")
          .trim()
          .toLowerCase() as TemplateAttributeType;

        return {
          name: attributeName,
          type: TEMPLATE_ATTRIBUTE_TYPES_SET.has(attributeType)
            ? attributeType
            : "string",
          required: requiredFields.has(attributeName),
        };
      });
  }, [schemaDetail]);

  useEffect(() => {
    if (!schemas.length) {
      void dispatch(fetchSchemas());
    }
  }, [dispatch, schemas.length]);

  useEffect(() => {
    if (
      hasInitializedSchemaVisibility ||
      !form.schemaId ||
      !selectedSchema
    ) {
      return;
    }

    setForm((currentValue) => {
      if (currentValue.schemaId !== form.schemaId) {
        return currentValue;
      }

      return {
        ...currentValue,
        schemaPublic: Boolean(selectedSchema.isPublic),
      };
    });
    setHasInitializedSchemaVisibility(true);
  }, [
    form.schemaId,
    hasInitializedSchemaVisibility,
    selectedSchema,
  ]);

  useEffect(() => {
    if (!isCreateMode || !hasSchemaId || !isKnownSchemaId || !schemaAttributes.length) {
      return;
    }

    if (autoFilledSchemaId === form.schemaId) {
      return;
    }

    setForm((currentValue) => {
      if (currentValue.schemaId !== form.schemaId) {
        return currentValue;
      }

      return {
        ...currentValue,
        attributes: schemaAttributes,
      };
    });
    setAutoFilledSchemaId(form.schemaId);
  }, [
    autoFilledSchemaId,
    form.schemaId,
    hasSchemaId,
    isCreateMode,
    isKnownSchemaId,
    schemaAttributes,
  ]);

  const addAttribute = () => {
    setForm((currentValue) => ({
      ...currentValue,
      attributes: [
        ...currentValue.attributes,
        {
          name: "",
          type: "string",
          required: false,
        },
      ],
    }));
  };

  const isValid = useMemo(() => {
    if (!form.name.trim()) {
      return false;
    }

    if (!isCreateMode && !hasSchemaId) {
      return false;
    }

    if (hasSchemaId && !isKnownSchemaId) {
      return false;
    }

    return form.attributes.every((attribute) => attribute.name.trim());
  }, [form.attributes, form.name, hasSchemaId, isCreateMode, isKnownSchemaId]);

  const schemaVisibilityHint = useMemo(() => {
    if (!hasSchemaId) {
      return i18n.t("pages.templates.form.fields.schemaPublicHintGenerated");
    }

    if (!selectedSchema) {
      return undefined;
    }

    return selectedSchema.canManageVisibility
      ? i18n.t("pages.templates.form.fields.schemaPublicHintManaged")
      : i18n.t("pages.templates.form.fields.schemaPublicHintReadonly");
  }, [hasSchemaId, selectedSchema]);

  const formatSchemaLabel = (schema: {
    id: string;
    name: string;
    isPublic: boolean;
  }) =>
    `${schema.name || schema.id} (${i18n.t(
      schema.isPublic
        ? "pages.templates.form.fields.visibilityPublic"
        : "pages.templates.form.fields.visibilityPrivate"
    )})`;

  const submit = async () => {
    if (!form.name.trim()) {
      triggerToast(i18n.t("pages.templates.form.validation.name"), "error");
      return;
    }

    if (!hasSchemaId && !isCreateMode) {
      triggerToast(i18n.t("pages.templates.form.validation.schemaId"), "error");
      return;
    }

    if (hasSchemaId && !isKnownSchemaId) {
      triggerToast(
        i18n.t("pages.templates.form.validation.schemaIdUnsupported"),
        "error"
      );
      return;
    }

    const hasEmptyAttributeName = form.attributes.some(
      (attribute) => !attribute.name.trim()
    );
    if (hasEmptyAttributeName) {
      triggerToast(
        i18n.t("pages.templates.form.validation.attributes"),
        "error"
      );
      return;
    }

    await onSubmit({
      ...form,
      name: form.name.trim(),
      schemaId: form.schemaId.trim(),
      autoIssue: Boolean(form.autoIssue),
      schemaPublic: Boolean(form.schemaPublic),
      attributes: form.attributes.map((attribute) => ({
        ...attribute,
        name: attribute.name.trim(),
      })),
    });
  };

  return (
    <Box className="dashboard-form-shell">
      <Box className="dashboard-form-panel">
        <Box className="dashboard-form-grid dashboard-form-grid--two-up">
          <TextField
            label={i18n.t("pages.templates.form.fields.name")}
            value={form.name}
            onChange={(event) =>
              setForm((currentValue) => ({
                ...currentValue,
                name: event.target.value,
              }))
            }
            fullWidth
          />
          <TextField
            select
            label={i18n.t("pages.templates.form.fields.schemaId")}
            value={form.schemaId}
            onChange={(event) => {
              const nextSchemaId = String(event.target.value || "").trim();
              const nextSchema =
                normalizedSchemas.find((schema) => schema.id === nextSchemaId) ||
                null;

              setForm((currentValue) => ({
                ...currentValue,
                schemaId: nextSchemaId,
                schemaPublic: nextSchema ? Boolean(nextSchema.isPublic) : false,
              }));
              setAutoFilledSchemaId(null);
              setHasInitializedSchemaVisibility(true);
            }}
            error={hasSchemaId && !isKnownSchemaId}
            helperText={
              hasSchemaId && !isKnownSchemaId
                ? i18n.t("pages.templates.form.validation.schemaIdUnsupported")
                : undefined
            }
            fullWidth
            SelectProps={{
              displayEmpty: true,
              renderValue: (selected) => {
                const selectedSchemaId = String(selected || "").trim();
                if (!selectedSchemaId) {
                  return isCreateMode
                    ? i18n.t("pages.templates.form.fields.autoSchema")
                    : i18n.t("pages.templates.form.fields.selectSchema");
                }

                const selectedSchema = selectableSchemas.find(
                  (schema) => schema.id === selectedSchemaId
                );
                return selectedSchema
                  ? formatSchemaLabel(selectedSchema)
                  : selectedSchemaId;
              },
            }}
          >
            <MenuItem value="">
              {isCreateMode
                ? i18n.t("pages.templates.form.fields.autoSchema")
                : i18n.t("pages.templates.form.fields.selectSchema")}
            </MenuItem>
            {Boolean(form.schemaId) && !isKnownSchemaId && (
              <MenuItem value={form.schemaId}>
                {form.schemaId}
              </MenuItem>
            )}
            {selectableSchemas.map((schema) => (
              <MenuItem
                key={schema.id}
                value={schema.id}
              >
                {formatSchemaLabel(schema)}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      <Box className="dashboard-form-toggle-grid">
        <Box className="dashboard-form-toggle-card">
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(form.schemaPublic)}
                disabled={
                  hasSchemaId &&
                  (!selectedSchema || !selectedSchema.canManageVisibility)
                }
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    schemaPublic: event.target.checked,
                  }))
                }
              />
            }
            label={i18n.t("pages.templates.form.fields.schemaPublic")}
          />
          {schemaVisibilityHint && (
            <Typography variant="body2">
              {schemaVisibilityHint}
            </Typography>
          )}
        </Box>

        <Box className="dashboard-form-toggle-card">
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(form.autoIssue)}
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    autoIssue: event.target.checked,
                  }))
                }
              />
            }
            label={i18n.t("pages.templates.form.fields.autoIssue")}
          />
          <Typography variant="body2">
            {i18n.t("pages.templates.form.fields.autoIssueHint")}
          </Typography>
        </Box>
      </Box>

      <Box className="dashboard-form-panel">
        <Box className="dashboard-form-section-head">
          <Typography variant="subtitle1">
            {i18n.t("pages.templates.form.fields.attributes")}
          </Typography>
          <Button
            variant="text"
            onClick={addAttribute}
          >
            {i18n.t("pages.templates.form.addAttribute")}
          </Button>
        </Box>
        <Stack className="dashboard-attribute-list">
          {form.attributes.map((attribute, index) => (
            <Box
              key={`attribute-${index}`}
              className="dashboard-attribute-row"
            >
              <TextField
                label={i18n.t("pages.templates.form.fields.attributeName")}
                value={attribute.name}
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    attributes: currentValue.attributes.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            name: event.target.value,
                          }
                        : item
                    ),
                  }))
                }
                fullWidth
              />
              <Select
                value={attribute.type}
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    attributes: currentValue.attributes.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            type: event.target.value as TemplateAttributeType,
                          }
                        : item
                    ),
                  }))
                }
                className="dashboard-attribute-select"
                renderValue={(selected) =>
                  getTemplateAttributeTypeLabel(selected as TemplateAttributeType)
                }
              >
                {TEMPLATE_ATTRIBUTE_TYPES.map((type) => (
                  <MenuItem
                    key={type}
                    value={type}
                  >
                    {getTemplateAttributeTypeLabel(type)}
                  </MenuItem>
                ))}
              </Select>
              <FormControlLabel
                className="dashboard-attribute-required"
                control={
                  <Checkbox
                    checked={attribute.required}
                    onChange={(event) =>
                      setForm((currentValue) => ({
                        ...currentValue,
                        attributes: currentValue.attributes.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  required: event.target.checked,
                                }
                              : item
                        ),
                      }))
                    }
                  />
                }
                label={i18n.t("pages.templates.form.fields.required")}
              />
              <IconButton
                aria-label="remove attribute"
                className="dashboard-attribute-delete"
                onClick={() =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    attributes: currentValue.attributes.filter(
                      (_, itemIndex) => itemIndex !== index
                    ),
                  }))
                }
              >
                <DeleteOutlineOutlinedIcon />
              </IconButton>
            </Box>
          ))}
        </Stack>
      </Box>

      <Stack
        direction={{ xs: "column-reverse", sm: "row" }}
        spacing={1}
        className="dashboard-form-actions"
        justifyContent="flex-end"
      >
        <Button
          variant="contained"
          className="neutral-button"
          onClick={onCancel}
        >
          {i18n.t("pages.templates.form.cancel")}
        </Button>
        <Button
          variant="contained"
          disabled={loading || !isValid}
          onClick={submit}
          startIcon={<AddCircleOutlineOutlinedIcon />}
        >
          {submitLabel}
        </Button>
      </Stack>
    </Box>
  );
};

export { TemplateForm };
