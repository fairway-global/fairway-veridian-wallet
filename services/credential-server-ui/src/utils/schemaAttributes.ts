import { IGNORE_ATTRIBUTES } from "../const";
import { SchemaDetail } from "../store/reducers/schemasSlice.types";

export interface SchemaAttributeDefinition {
  name: string;
  label: string;
  description: string;
  required: boolean;
  type: string;
}

export interface DisplaySchemaAttribute extends SchemaAttributeDefinition {
  value: string;
}

function getSubjectAttributeSchema(schemaDetail?: SchemaDetail) {
  return schemaDetail?.properties?.a?.oneOf?.[1];
}

export function formatSchemaAttributeLabel(name: string): string {
  const normalized = String(name || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();

  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "";
}

export function getSchemaAttributeDefinitions(
  schemaDetail?: SchemaDetail
): SchemaAttributeDefinition[] {
  const attributeSchema = getSubjectAttributeSchema(schemaDetail);
  const properties =
    (attributeSchema?.properties as Record<
      string,
      { description?: string; type?: string } | undefined
    >) || {};
  const requiredFields = new Set(attributeSchema?.required || []);

  return Object.entries(properties)
    .filter(([name]) => !IGNORE_ATTRIBUTES.includes(name))
    .map(([name, property]) => ({
      name,
      label: formatSchemaAttributeLabel(name),
      description: String(property?.description || "").trim(),
      required: requiredFields.has(name),
      type: String(property?.type || "string").trim().toLowerCase(),
    }));
}

export function formatSchemaAttributeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatSchemaAttributeValue(item)).join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export function getDisplaySchemaAttributes(
  attributes: Record<string, unknown>,
  schemaDetail?: SchemaDetail
): DisplaySchemaAttribute[] {
  const definitions = getSchemaAttributeDefinitions(schemaDetail);
  const definitionByName = new Map(
    definitions.map((definition) => [definition.name, definition])
  );
  const definitionOrder = new Map(
    definitions.map((definition, index) => [definition.name, index])
  );

  return Object.entries(attributes || {})
    .filter(([name, value]) => {
      if (IGNORE_ATTRIBUTES.includes(name)) {
        return false;
      }

      return value !== undefined && value !== null && String(value).trim() !== "";
    })
    .sort(([leftName], [rightName]) => {
      return (
        (definitionOrder.get(leftName) ?? Number.MAX_SAFE_INTEGER) -
        (definitionOrder.get(rightName) ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .map(([name, value]) => {
      const definition = definitionByName.get(name);

      return {
        name,
        label: definition?.label || formatSchemaAttributeLabel(name),
        description: definition?.description || "",
        required: definition?.required || false,
        type: definition?.type || typeof value,
        value: formatSchemaAttributeValue(value),
      };
    });
}
