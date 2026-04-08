const ABSOLUTE_URL_RE = /https?:\/\/[^\s"'`]+/i;

const normalizeApiBaseUrl = (
  value: string | undefined,
  fallback: string
): string => {
  const rawValue = String(value || "").trim();
  const candidate = rawValue || fallback;
  const extractedAbsoluteUrl = candidate.match(ABSOLUTE_URL_RE)?.[0];
  const cleanedValue =
    extractedAbsoluteUrl ||
    candidate.replace(/^['"]+|['"]+$/g, "").trim() ||
    fallback;

  return cleanedValue.replace(/\/+$/, "");
};

export { normalizeApiBaseUrl };
