import { Capacitor } from "@capacitor/core";
import { normalizeApiBaseUrl } from "./envUrl";

export type IdentityVerificationProvider = "fayda" | "candour";

const DEFAULT_CALLBACK_PATH = "/callback";
const DEFAULT_FAYDA_NATIVE_REDIRECT_URI =
  "org.cardanofoundation.idw://fayda/callback";
const DEFAULT_CANDOUR_BRIDGE_REDIRECT_URI =
  "https://connect.fairwallet.et/callback?provider=candour&bridgeToApp=1";
export const CANDOUR_BRIDGE_TO_APP_QUERY_PARAM = "bridgeToApp";

export const IDENTITY_VERIFIED_STATUSES = new Set([
  "verified",
  "pending_manual_review",
  "credential_issued",
]);

export const IDENTITY_VERIFIED_STORAGE_KEY = "fayda_verified";
export const IDENTITY_PENDING_CONNECTION_ID_STORAGE_KEY =
  "fayda_pending_connection_id";
export const IDENTITY_PENDING_CONNECTION_LABEL_STORAGE_KEY =
  "fayda_pending_connection_label";
export const CANDOUR_SESSION_ID_STORAGE_KEY = "candour_verification_session_id";

function isHttpUrl(value: string | undefined): boolean {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return false;
  }

  try {
    const url = new URL(normalizedValue);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getBrowserCallbackUrl(provider: IdentityVerificationProvider): string {
  if (typeof window === "undefined" || !window.location?.origin) {
    return "";
  }

  try {
    const originUrl = new URL(window.location.origin);
    if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") {
      return "";
    }

    originUrl.pathname = DEFAULT_CALLBACK_PATH;
    originUrl.search = "";
    originUrl.hash = "";

    if (provider === "candour") {
      originUrl.searchParams.set("provider", "candour");
    }

    return originUrl.toString();
  } catch {
    return "";
  }
}

function normalizeCandourBridgeRedirectUri(value: string): string {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return "";
  }

  try {
    const callbackUrl = new URL(normalizedValue);
    callbackUrl.searchParams.set("provider", "candour");

    if (Capacitor.isNativePlatform()) {
      callbackUrl.searchParams.set(CANDOUR_BRIDGE_TO_APP_QUERY_PARAM, "1");
    } else {
      callbackUrl.searchParams.delete(CANDOUR_BRIDGE_TO_APP_QUERY_PARAM);
    }

    return callbackUrl.toString();
  } catch {
    return normalizedValue;
  }
}

function mergeSearchParams(
  searchParams: URLSearchParams | string | undefined
): URLSearchParams {
  if (!searchParams) {
    return new URLSearchParams();
  }

  return searchParams instanceof URLSearchParams
    ? new URLSearchParams(searchParams)
    : new URLSearchParams(searchParams);
}

function normalizeProvider(
  value: string | undefined
): IdentityVerificationProvider {
  return String(value || "")
    .trim()
    .toLowerCase() === "candour"
    ? "candour"
    : "fayda";
}

export function getIdentityVerificationProvider(
  overrideValue?: string
): IdentityVerificationProvider {
  return normalizeProvider(
    overrideValue || process.env.REACT_APP_VERIFICATION_PROVIDER
  );
}

export function getIdentityVerificationApiBase(
  provider: IdentityVerificationProvider
): string {
  if (provider === "candour") {
    return normalizeApiBaseUrl(
      process.env.REACT_APP_CANDOUR_ISSUER_API ||
        process.env.REACT_APP_CREDENTIAL_SERVER_API ||
        process.env.REACT_APP_FAYDA_ISSUER_API,
      "http://localhost:3001"
    );
  }

  return normalizeApiBaseUrl(
    process.env.REACT_APP_FAYDA_ISSUER_API ||
      process.env.REACT_APP_CREDENTIAL_SERVER_API,
    "http://localhost:3001"
  );
}

export function getIdentityVerificationStatusPath(
  provider: IdentityVerificationProvider
): string {
  return provider === "candour" ? "/saveCandour" : "/saveFayda";
}

export function getIdentityVerificationNativeRedirectUri(
  provider: IdentityVerificationProvider
): string {
  if (provider === "candour") {
    const configuredNativeRedirectUri = String(
      process.env.REACT_APP_CANDOUR_NATIVE_REDIRECT_URI ||
        (isHttpUrl(process.env.REACT_APP_CANDOUR_REDIRECT_URI)
          ? ""
          : process.env.REACT_APP_CANDOUR_REDIRECT_URI) ||
        `${DEFAULT_FAYDA_NATIVE_REDIRECT_URI}?provider=candour`
    ).trim();

    return configuredNativeRedirectUri;
  }

  return (
    process.env.REACT_APP_FAYDA_REDIRECT_URI ||
    DEFAULT_FAYDA_NATIVE_REDIRECT_URI
  );
}

export function getIdentityVerificationRedirectUri(
  provider: IdentityVerificationProvider
): string {
  if (provider === "candour") {
    const configuredBridgeRedirectUri = normalizeCandourBridgeRedirectUri(
      process.env.REACT_APP_CANDOUR_WEB_REDIRECT_URI ||
        (isHttpUrl(process.env.REACT_APP_CANDOUR_REDIRECT_URI)
          ? process.env.REACT_APP_CANDOUR_REDIRECT_URI
          : "") ||
        getBrowserCallbackUrl("candour") ||
        DEFAULT_CANDOUR_BRIDGE_REDIRECT_URI
    );

    return configuredBridgeRedirectUri;
  }

  return getIdentityVerificationNativeRedirectUri("fayda");
}

export function buildIdentityVerificationNativeCallbackUri(
  provider: IdentityVerificationProvider,
  searchParams?: URLSearchParams | string
): string {
  const callbackUrl = new URL(
    getIdentityVerificationNativeRedirectUri(provider)
  );
  const mergedSearchParams = new URLSearchParams(callbackUrl.search);
  const incomingSearchParams = mergeSearchParams(searchParams);

  incomingSearchParams.forEach((value, key) => {
    mergedSearchParams.set(key, value);
  });

  if (provider === "candour") {
    mergedSearchParams.set("provider", "candour");
    mergedSearchParams.delete(CANDOUR_BRIDGE_TO_APP_QUERY_PARAM);
  }

  callbackUrl.search = mergedSearchParams.toString()
    ? `?${mergedSearchParams.toString()}`
    : "";
  callbackUrl.hash = "";

  return callbackUrl.toString();
}
