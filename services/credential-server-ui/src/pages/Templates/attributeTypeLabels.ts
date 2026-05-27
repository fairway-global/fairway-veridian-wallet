import { i18n } from "../../i18n";
import { TemplateAttributeType } from "../../services/template.types";
import { TEMPLATE_ATTRIBUTE_TYPES } from "../../utils/templateAttributeFields";

const TEMPLATE_ATTRIBUTE_TYPE_KEYS = new Set<TemplateAttributeType>(
  TEMPLATE_ATTRIBUTE_TYPES
);

const getTemplateAttributeTypeLabel = (type: string) => {
  const normalizedType = String(type || "").trim().toLowerCase();

  if (TEMPLATE_ATTRIBUTE_TYPE_KEYS.has(normalizedType as TemplateAttributeType)) {
    return i18n.t(
      `pages.templates.form.fields.attributeTypes.${normalizedType}`
    );
  }

  return type;
};

export { getTemplateAttributeTypeLabel };
