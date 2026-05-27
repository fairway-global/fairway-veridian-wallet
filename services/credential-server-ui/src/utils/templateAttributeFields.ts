import {
  TemplateAttribute,
  TemplateAttributeType,
} from "../services/template.types";

export const TEMPLATE_ATTRIBUTE_TYPES: TemplateAttributeType[] = [
  "string",
  "integer",
  "number",
  "boolean",
  "date",
];

const TEMPLATE_ATTRIBUTE_TYPE_SET = new Set(TEMPLATE_ATTRIBUTE_TYPES);

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

const GENDER_ATTRIBUTE_NAMES = new Set(["gender", "sex"]);
const EMAIL_ATTRIBUTE_NAMES = new Set(["email", "emailaddress", "mail"]);
const PHONE_ATTRIBUTE_NAMES = new Set([
  "phone",
  "phonenumber",
  "phone_number",
  "mobile",
  "mobilenumber",
]);
const URL_ATTRIBUTE_NAMES = new Set([
  "url",
  "website",
  "homepage",
  "link",
]);

const BOOLEAN_OPTIONS = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
] as const;

const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
] as const;

export interface AttributeSelectOption {
  value: string;
  label: string;
}

export interface TemplateAttributeInputConfig {
  control: "text" | "number" | "select" | "date";
  htmlInputType?: "text" | "email" | "tel" | "url";
  options?: AttributeSelectOption[];
}

function normalizeLookupKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeGenderValue(value: unknown): string {
  const normalized = normalizeLookupKey(value);
  if (!normalized) {
    return "";
  }

  if (["m", "male"].includes(normalized)) {
    return "Male";
  }
  if (["f", "female"].includes(normalized)) {
    return "Female";
  }

  return "";
}

function normalizeBooleanValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  const normalized = normalizeLookupKey(value);
  if (!normalized) {
    return "";
  }
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return "true";
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return "false";
  }

  return "";
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

function appendCurrentValueOption(
  options: readonly AttributeSelectOption[],
  currentValue?: string
): AttributeSelectOption[] {
  const normalizedValue = String(currentValue || "").trim();
  if (!normalizedValue) {
    return [...options];
  }

  if (options.some((option) => option.value === normalizedValue)) {
    return [...options];
  }

  return [
    ...options,
    {
      value: normalizedValue,
      label: normalizedValue,
    },
  ];
}

export function isDateAttributeName(name: unknown): boolean {
  const normalized = normalizeLookupKey(name);
  return Boolean(normalized) && (
    DATE_ATTRIBUTE_NAMES.has(normalized) || normalized.endsWith("date")
  );
}

export function formatTemplateAttributeLabel(name: string): string {
  const normalized = String(name || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();

  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "";
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

export function normalizeDateInputValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const directMatch = normalized.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (directMatch) {
    const [, yearPart, monthPart, dayPart] = directMatch;
    const year = Number(yearPart);
    const month = Number(monthPart);
    const day = Number(dayPart);

    if (!isValidDateParts(year, month, day)) {
      return "";
    }

    return `${yearPart}-${padDatePart(monthPart)}-${padDatePart(dayPart)}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeTemplateAttributeValueForInput(
  attribute: Pick<TemplateAttribute, "name" | "type">,
  value: unknown
): string {
  if (attribute.type === "boolean") {
    return normalizeBooleanValue(value);
  }

  if (attribute.type === "date" || isDateAttributeName(attribute.name)) {
    return normalizeDateInputValue(value);
  }

  if (GENDER_ATTRIBUTE_NAMES.has(normalizeLookupKey(attribute.name))) {
    return normalizeGenderValue(value);
  }

  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

export function getTemplateAttributeInputConfig(
  attribute: Pick<TemplateAttribute, "name" | "type">,
  currentValue?: string
): TemplateAttributeInputConfig {
  const normalizedName = normalizeLookupKey(attribute.name);

  if (attribute.type === "boolean") {
    return {
      control: "select",
      options: appendCurrentValueOption(BOOLEAN_OPTIONS, currentValue),
    };
  }

  if (attribute.type === "date" || isDateAttributeName(attribute.name)) {
    return {
      control: "date",
    };
  }

  if (GENDER_ATTRIBUTE_NAMES.has(normalizedName)) {
    return {
      control: "select",
      options: [...GENDER_OPTIONS],
    };
  }

  if (attribute.type === "integer" || attribute.type === "number") {
    return {
      control: "number",
    };
  }

  if (EMAIL_ATTRIBUTE_NAMES.has(normalizedName)) {
    return {
      control: "text",
      htmlInputType: "email",
    };
  }

  if (PHONE_ATTRIBUTE_NAMES.has(normalizedName)) {
    return {
      control: "text",
      htmlInputType: "tel",
    };
  }

  if (URL_ATTRIBUTE_NAMES.has(normalizedName)) {
    return {
      control: "text",
      htmlInputType: "url",
    };
  }

  return {
    control: "text",
    htmlInputType: "text",
  };
}
