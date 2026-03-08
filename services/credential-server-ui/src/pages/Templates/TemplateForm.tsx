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
  const normalizedSchemas = useMemo(
    () =>
      schemas
        .map((schema) => ({
          id: String(schema.id || "").trim(),
          name: String(schema.name || "").trim(),
        }))
        .filter((schema) => schema.id),
    [schemas]
  );
  const hasSchemaId = Boolean(form.schemaId.trim());
  const schemaDetail = useSchemaDetail(hasSchemaId ? form.schemaId : undefined);
  const isKnownSchemaId = useMemo(
    () =>
      !hasSchemaId ||
      normalizedSchemas.some((schema) => schema.id === form.schemaId) ||
      Boolean(initialValue?.schemaId === form.schemaId),
    [form.schemaId, hasSchemaId, initialValue?.schemaId, normalizedSchemas]
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
      attributes: form.attributes.map((attribute) => ({
        ...attribute,
        name: attribute.name.trim(),
      })),
    });
  };

  return (
    <Box>
      <Stack spacing={2}>
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
          onChange={(event) =>
            setForm((currentValue) => ({
              ...currentValue,
              schemaId: event.target.value,
            }))
          }
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

              const selectedSchema = normalizedSchemas.find(
                (schema) => schema.id === selectedSchemaId
              );
              return selectedSchema?.name || selectedSchemaId;
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
          {normalizedSchemas.map((schema) => (
            <MenuItem
              key={schema.id}
              value={schema.id}
            >
              {schema.name || schema.id}
            </MenuItem>
          ))}
        </TextField>
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
        <Typography
          variant="body2"
          color="text.secondary"
        >
          {i18n.t("pages.templates.form.fields.autoIssueHint")}
        </Typography>
        <Stack spacing={1}>
          <Typography variant="subtitle1">
            {i18n.t("pages.templates.form.fields.attributes")}
          </Typography>
          {form.attributes.map((attribute, index) => (
            <Stack
              key={`attribute-${index}`}
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", md: "center" }}
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
                sx={{ minWidth: "10rem" }}
              >
                {TEMPLATE_ATTRIBUTE_TYPES.map((type) => (
                  <MenuItem
                    key={type}
                    value={type}
                  >
                    {type}
                  </MenuItem>
                ))}
              </Select>
              <FormControlLabel
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
            </Stack>
          ))}
        </Stack>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        marginTop={2}
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
        <Button
          variant="text"
          onClick={addAttribute}
        >
          {i18n.t("pages.templates.form.addAttribute")}
        </Button>
      </Stack>
    </Box>
  );
};

export { TemplateForm };
