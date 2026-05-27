import { TemplateAttribute } from "./dashboardStore.types";
import {
  coerceTemplateAttributeValue,
  hasMeaningfulValue,
} from "./templateAttributeUtils";

type FaydaData = Record<string, unknown>;

const FAYDA_ID_KEYS = [
  "fayda_id",
  "id",
  "sub",
  "faydaId",
  "national_id",
] as const;

const FAYDA_ATTRIBUTE_ALIASES: Record<string, string[]> = {
  address: ["address"],
  birthdate: ["birthdate", "dateofbirth", "dob"],
  country: ["nationality", "country", "citizenship"],
  dateofbirth: ["birthdate", "dateofbirth", "dob"],
  dob: ["birthdate", "dateofbirth", "dob"],
  email: ["email", "emailaddress", "mail"],
  emailaddress: ["email", "emailaddress", "mail"],
  faydaid: ["faydaid", "id", "sub", "nationalid"],
  fullname: ["name", "fullname", "displayname"],
  gender: ["gender", "sex"],
  id: ["faydaid", "id", "sub", "nationalid"],
  name: ["name", "fullname", "displayname"],
  nationalid: ["faydaid", "id", "sub", "nationalid"],
  nationality: ["nationality", "country", "citizenship"],
  phone: ["phonenumber", "phone", "mobile", "mobilenumber"],
  phonenumber: ["phonenumber", "phone", "mobile", "mobilenumber"],
  region: ["region"],
  sex: ["gender", "sex"],
  sub: ["faydaid", "id", "sub", "nationalid"],
  woreda: ["woreda"],
  zone: ["zone"],
};

export interface FaydaPrefillResult {
  values: Record<string, unknown>;
  matchedFields: string[];
}

function toTrimmedString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function isBase64DataUri(value: unknown): boolean {
  return typeof value === "string" && /^data:[^;]+;base64,/i.test(value);
}

function normalizeLookupKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function formatAddress(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const address = value as Record<string, unknown>;
  return [address.zone, address.woreda, address.region]
    .map((item) => toTrimmedString(item))
    .filter(Boolean)
    .join(", ");
}

function addLookupValue(
  lookup: Map<string, unknown>,
  key: string,
  value: unknown
): void {
  const normalizedKey = normalizeLookupKey(key);
  if (!normalizedKey || lookup.has(normalizedKey) || !hasMeaningfulValue(value)) {
    return;
  }

  lookup.set(normalizedKey, value);
}

function extractFaydaIdFromRecord(record: Record<string, unknown>): string {
  for (const key of FAYDA_ID_KEYS) {
    const value = toTrimmedString(record[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function extractFaydaId(faydaData: FaydaData): string {
  const direct = extractFaydaIdFromRecord(faydaData);
  if (direct) {
    return direct;
  }

  const nested = faydaData.additionalProp1;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return extractFaydaIdFromRecord(nested as Record<string, unknown>);
  }

  return "";
}

function buildLookupFromData(
  lookup: Map<string, unknown>,
  data: FaydaData,
  options?: { includeNested?: boolean }
): void {
  Object.entries(data).forEach(([key, value]) => {
    if (
      key === "picture" ||
      key === "additionalProp1" ||
      isBase64DataUri(value) ||
      !hasMeaningfulValue(value)
    ) {
      return;
    }

    addLookupValue(lookup, key, value);
  });

  const faydaId = extractFaydaId(data);
  if (faydaId) {
    ["fayda_id", "faydaId", "id", "sub", "national_id", "nationalId"].forEach(
      (key) => addLookupValue(lookup, key, faydaId)
    );
  }

  const addressValue = data.address;
  if (addressValue && typeof addressValue === "object" && !Array.isArray(addressValue)) {
    const address = addressValue as Record<string, unknown>;
    addLookupValue(lookup, "address", formatAddress(address));
    addLookupValue(lookup, "zone", address.zone);
    addLookupValue(lookup, "woreda", address.woreda);
    addLookupValue(lookup, "region", address.region);
  }

  if (!options?.includeNested) {
    return;
  }

  const nested = data.additionalProp1;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    buildLookupFromData(lookup, nested as FaydaData);
  }
}

function getAttributeAliasCandidates(attributeName: string): string[] {
  const normalizedAttribute = normalizeLookupKey(attributeName);

  return Array.from(
    new Set([
      normalizedAttribute,
      ...(FAYDA_ATTRIBUTE_ALIASES[normalizedAttribute] || []),
    ])
  );
}

function toTemplateAttributeValue(
  rawValue: unknown,
  attribute: TemplateAttribute
): string | number | boolean | undefined {
  if (typeof rawValue === "object" && attribute.type === "string") {
    const formattedAddress = formatAddress(rawValue);
    if (formattedAddress) {
      return formattedAddress;
    }

    return JSON.stringify(rawValue);
  }

  return coerceTemplateAttributeValue(rawValue, attribute);
}

export function getFaydaPrefillForTemplateAttributes(input: {
  attributes: TemplateAttribute[];
  mappedData?: Record<string, unknown> | null;
  faydaData?: Record<string, unknown> | null;
}): FaydaPrefillResult {
  const attributes = Array.isArray(input.attributes) ? input.attributes : [];
  const lookup = new Map<string, unknown>();

  if (input.mappedData && typeof input.mappedData === "object") {
    buildLookupFromData(lookup, input.mappedData);
  }

  if (input.faydaData && typeof input.faydaData === "object") {
    buildLookupFromData(lookup, input.faydaData, { includeNested: true });
  }

  const values: Record<string, unknown> = {};
  const matchedFields: string[] = [];

  for (const attribute of attributes) {
    const candidates = getAttributeAliasCandidates(attribute.name);
    const rawValue = candidates
      .map((candidate) => lookup.get(candidate))
      .find((value) => hasMeaningfulValue(value));

    const typedValue = toTemplateAttributeValue(rawValue, attribute);
    if (typedValue === undefined) {
      continue;
    }

    values[attribute.name] = typedValue;
    matchedFields.push(attribute.name);
  }

  return {
    values,
    matchedFields,
  };
}
