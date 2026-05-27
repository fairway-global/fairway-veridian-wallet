import {
  TemplateAttribute,
  TemplateAttributeType,
} from "./dashboardStore.types";

const TEMPLATE_ATTRIBUTE_TYPE_VALUES = [
  "string",
  "integer",
  "number",
  "boolean",
  "date",
] as const;

const TEMPLATE_ATTRIBUTE_TYPE_SET = new Set<TemplateAttributeType>(
  TEMPLATE_ATTRIBUTE_TYPE_VALUES
);

const DATE_ATTRIBUTE_NAMES = new Set([
  "birthdate",
  "dateofbirth",
  "dob",
  "date",
  "issueddate",
  "expirydate",
  "expirationdate",
  "startdate",
  "enddate",
]);

function normalizeLookupKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function padDatePart(value: string): string {
  return value.padStart(2, "0");
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return Boolean(value.trim());
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
}

export function isDateAttributeName(name: unknown): boolean {
  const normalized = normalizeLookupKey(name);
  return Boolean(normalized) && (
    DATE_ATTRIBUTE_NAMES.has(normalized) || normalized.endsWith("date")
  );
}

export function normalizeTemplateAttributeType(input: {
  name?: unknown;
  type?: unknown;
  format?: unknown;
}): TemplateAttributeType {
  const normalizedType = String(input.type || "string")
    .trim()
    .toLowerCase();
  const normalizedFormat = String(input.format || "")
    .trim()
    .toLowerCase();

  if (
    normalizedType === "date" ||
    normalizedFormat === "date" ||
    (normalizedType === "string" && isDateAttributeName(input.name))
  ) {
    return "date";
  }

  return TEMPLATE_ATTRIBUTE_TYPE_SET.has(normalizedType as TemplateAttributeType)
    ? (normalizedType as TemplateAttributeType)
    : "string";
}

export function getJsonSchemaTypeForAttribute(
  type: TemplateAttributeType
): { type: string; format?: string } {
  if (type === "date") {
    return {
      type: "string",
      format: "date",
    };
  }

  return {
    type,
  };
}

export function normalizeDateValue(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value || "").trim();
  if (!normalized) {
    return undefined;
  }

  const directMatch = normalized.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (directMatch) {
    const [, yearPart, monthPart, dayPart] = directMatch;
    const year = Number(yearPart);
    const month = Number(monthPart);
    const day = Number(dayPart);

    if (!isValidDateParts(year, month, day)) {
      return undefined;
    }

    return `${yearPart}-${padDatePart(monthPart)}-${padDatePart(dayPart)}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

export function coerceTemplateAttributeValue(
  rawValue: unknown,
  attribute: Pick<TemplateAttribute, "name" | "type">
): string | number | boolean | undefined {
  if (!hasMeaningfulValue(rawValue)) {
    return undefined;
  }

  if (attribute.type === "integer") {
    const parsed = Number.parseInt(String(rawValue).trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (attribute.type === "number") {
    const parsed = Number(String(rawValue).trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (attribute.type === "boolean") {
    if (typeof rawValue === "boolean") {
      return rawValue;
    }

    const normalized = String(rawValue).trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }

    return undefined;
  }

  if (attribute.type === "date") {
    return normalizeDateValue(rawValue);
  }

  return String(rawValue).trim() || undefined;
}
