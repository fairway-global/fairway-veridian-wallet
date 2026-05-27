import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadEnvFromFile(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(__dirname, "../.env"),
    resolve(__dirname, "../../.env"),
  ];

  const envPath = candidates.find((path) => existsSync(path));
  if (!envPath) return;

  const file = readFileSync(envPath, "utf-8");
  const lines = file.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFromFile();

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
const endpoint = process.env.ENDPOINT ?? `http://127.0.0.1:${port}`;
const oobiEndpoint = process.env.OOBI_ENDPOINT ?? endpoint;
const keriaUrl = process.env.KERIA_ENDPOINT ?? "http://127.0.0.1:3901";
const keriaBootUrl = process.env.KERIA_BOOT_ENDPOINT ?? "http://127.0.0.1:3903";
const jsonBodyLimit = process.env.JSON_BODY_LIMIT ?? "10mb";
const dashboardApiToken = process.env.DASHBOARD_API_TOKEN ?? "";
const allowLegacyUnauthRoutes =
  String(process.env.ALLOW_LEGACY_UNAUTH_ROUTES ?? "true").trim() !== "false";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/credential_server";
const jwtAccessSecret =
  process.env.JWT_ACCESS_SECRET ?? "dev-change-me-access-secret";
const jwtRefreshSecret =
  process.env.JWT_REFRESH_SECRET ?? "dev-change-me-refresh-secret";
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const dashboardUiUrl = process.env.DASHBOARD_UI_URL ?? "http://localhost:5173";
const smtpHost = process.env.SMTP_HOST ?? "";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE ?? "false").trim() === "true";
const smtpUser = process.env.SMTP_USER ?? "";
const smtpPassword = process.env.SMTP_PASSWORD ?? "";
const smtpConnectionTimeoutMs = Number(
  process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000
);
const smtpGreetingTimeoutMs = Number(
  process.env.SMTP_GREETING_TIMEOUT_MS || 10000
);
const smtpSocketTimeoutMs = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15000);
const smtpDnsTimeoutMs = Number(process.env.SMTP_DNS_TIMEOUT_MS || 5000);
const mailDebug = String(process.env.MAIL_DEBUG ?? "false").trim() === "true";
const mailFromName = process.env.MAIL_FROM_NAME ?? "Fairwallet";
const mailFromAddress =
  process.env.MAIL_FROM_ADDRESS || smtpUser || "notifications@fairwallet.et";
const gatewayJwtSecret =
  process.env.GATEWAY_JWT_SECRET ?? "dev-change-me-gateway-secret";
const gatewayJwtIssuer =
  process.env.GATEWAY_JWT_ISSUER ?? "fairway-backend-gateway";
const gatewayJwtAudience =
  process.env.GATEWAY_JWT_AUDIENCE ?? "credential-server-internal";
const accessTokenTtlSeconds = Number(
  process.env.ACCESS_TOKEN_TTL_SECONDS || 900
);
const refreshTokenTtlSeconds = Number(
  process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30
);
const passwordResetTtlSeconds = Number(
  process.env.PASSWORD_RESET_TTL_SECONDS || 60 * 60
);
const gatewayTokenMaxAgeSeconds = Number(
  process.env.GATEWAY_TOKEN_MAX_AGE_SECONDS || 300
);
const branEncryptionKey =
  process.env.BRAN_ENCRYPTION_KEY ?? "dev-change-me-bran-encryption-key";
const defaultIssuerCode = process.env.DEFAULT_ISSUER_CODE ?? "default";
const defaultIssuerName = process.env.DEFAULT_ISSUER_NAME ?? "Default Issuer";
const defaultIssuerAidAlias = process.env.DEFAULT_ISSUER_AID_ALIAS ?? "issuer";
const defaultAdminEmail =
  process.env.DEFAULT_ADMIN_EMAIL ?? "admin@default.local";
const defaultAdminPassword =
  process.env.DEFAULT_ADMIN_PASSWORD ?? "ChangeMe123!";
const defaultIssuerUserEmail =
  process.env.DEFAULT_ISSUER_USER_EMAIL ?? "issuer@default.local";
const defaultIssuerUserPassword =
  process.env.DEFAULT_ISSUER_USER_PASSWORD ?? "Issuer123!";
const defaultVerifierEmail =
  process.env.DEFAULT_VERIFIER_EMAIL ?? "verifier@default.local";
const defaultVerifierPassword =
  process.env.DEFAULT_VERIFIER_PASSWORD ?? "Verifier123!";
const candourApiBaseUrl =
  process.env.CANDOUR_API_BASE_URL ?? "https://rest-sandbox.candour.fi/v1";
const candourPublicKey = process.env.CANDOUR_PUBLIC_KEY ?? "";
const candourHmacKey = process.env.CANDOUR_HMAC_KEY ?? "";
const candourSessionTtlMinutes = Number(
  process.env.CANDOUR_SESSION_TTL_MINUTES || 15
);
const candourMaxTries = Number(process.env.CANDOUR_MAX_TRIES || 5);
const candourAllowIdWeb =
  String(process.env.CANDOUR_ALLOW_ID_WEB ?? "true").trim() !== "false";
const candourAllowIdApp =
  String(process.env.CANDOUR_ALLOW_ID_APP ?? "true").trim() !== "false";
const candourAllowRfidApp =
  String(process.env.CANDOUR_ALLOW_RFID_APP ?? "true").trim() !== "false";
const candourAllowIdCard =
  String(process.env.CANDOUR_ALLOW_ID_CARD ?? "true").trim() !== "false";
const candourDefaultCallbackUrl =
  process.env.CANDOUR_DEFAULT_CALLBACK_URL ??
  "https://connect.fairwallet.et/callback?provider=candour&bridgeToApp=1";

export const config = {
  endpoint: endpoint,
  oobiEndpoint: oobiEndpoint,
  port,
  jsonBodyLimit,
  dashboardApiToken,
  allowLegacyUnauthRoutes,
  databaseUrl,
  jwtAccessSecret,
  jwtRefreshSecret,
  googleClientId,
  dashboardUiUrl,
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPassword,
  smtpConnectionTimeoutMs,
  smtpGreetingTimeoutMs,
  smtpSocketTimeoutMs,
  smtpDnsTimeoutMs,
  mailDebug,
  mailFromName,
  mailFromAddress,
  gatewayJwtSecret,
  gatewayJwtIssuer,
  gatewayJwtAudience,
  accessTokenTtlSeconds,
  refreshTokenTtlSeconds,
  passwordResetTtlSeconds,
  gatewayTokenMaxAgeSeconds,
  branEncryptionKey,
  defaultIssuerCode,
  defaultIssuerName,
  defaultIssuerAidAlias,
  defaultAdminEmail,
  defaultAdminPassword,
  defaultIssuerUserEmail,
  defaultIssuerUserPassword,
  defaultVerifierEmail,
  defaultVerifierPassword,
  candour: {
    apiBaseUrl: candourApiBaseUrl,
    publicKey: candourPublicKey,
    hmacKey: candourHmacKey,
    sessionTtlMinutes: candourSessionTtlMinutes,
    maxTries: candourMaxTries,
    allowIdWeb: candourAllowIdWeb,
    allowIdApp: candourAllowIdApp,
    allowRfidApp: candourAllowRfidApp,
    allowIdCard: candourAllowIdCard,
    defaultCallbackUrl: candourDefaultCallbackUrl,
  },
  keria: {
    url: keriaUrl,
    bootUrl: keriaBootUrl,
  },
  path: {
    ping: "/ping",
    keriOobi: "/keriOobi",
    saveFayda: "/saveFayda",
    saveCandour: "/saveCandour",
    issueAcdcCredential: "/issueAcdcCredential",
    saveFaydaData: "/saveFaydaData",
    saveCandourData: "/saveCandourData",
    saveData: "/saveData",
    candourSession: "/candour/session",
    contacts: "/contacts",
    contactCredentials: "/contactCredentials",
    resolveOobi: "/resolveOobi",
    requestDisclosure: "/requestDisclosure",
    revokeCredential: "/revokeCredential",
    deleteRevokedCredentials: "/deleteRevokedCredentials",
    deleteContact: "/deleteContact",
    schemas: "/schemas",
    templates: "/api/templates",
    templateById: "/api/templates/:id",
    credentialsApi: "/api/credentials",
    credentialById: "/api/credentials/:id",
    issueCredentialApi: "/api/credentials/issue",
    revokeCredentialApi: "/api/credentials/:id/revoke",
    deleteCredentialApi: "/api/credentials/:id",
    authLoginV2: "/api/v2/auth/login",
    authGoogleV2: "/api/v2/auth/google",
    authRegisterVerifierV2: "/api/v2/auth/register/verifier",
    authRegisterVerifierGoogleV2: "/api/v2/auth/register/verifier/google",
    authRequestIssuerV2: "/api/v2/auth/request/issuer",
    authForgotPasswordV2: "/api/v2/auth/forgot-password",
    authResetPasswordV2: "/api/v2/auth/reset-password",
    authRefreshV2: "/api/v2/auth/refresh",
    authLogoutV2: "/api/v2/auth/logout",
    authMeV2: "/api/v2/auth/me",
    usersV2: "/api/v2/users",
    userByIdV2: "/api/v2/users/:id",
    adminUsersV2: "/api/v2/admin/users",
    adminUserByIdV2: "/api/v2/admin/users/:id",
    adminUserSendResetV2: "/api/v2/admin/users/:id/send-reset-password",
    adminRequestsV2: "/api/v2/admin/requests",
    adminRequestByIdV2: "/api/v2/admin/requests/:id",
    adminIssuerApplicationsV2: "/api/v2/admin/issuer-applications",
    adminIssuerApplicationByIdV2: "/api/v2/admin/issuer-applications/:id",
    accountProfileV2: "/api/v2/account/profile",
    accountRequestsV2: "/api/v2/account/requests",
    templatesV2: "/api/v2/templates",
    templateByIdV2: "/api/v2/templates/:id",
    credentialsApiV2: "/api/v2/credentials",
    credentialByIdV2: "/api/v2/credentials/:id",
    issueCredentialApiV2: "/api/v2/credentials/issue",
    issueCredentialPrefillApiV2: "/api/v2/credentials/issue/prefill",
    candourSessionV2: "/api/v2/candour/session",
    candourStatusV2: "/api/v2/candour/status",
    candourFinalizeV2: "/api/v2/candour/finalize",
    revokeCredentialApiV2: "/api/v2/credentials/:id/revoke",
    deleteCredentialApiV2: "/api/v2/credentials/:id",
    contactsV2: "/api/v2/contacts",
    contactCredentialsV2: "/api/v2/contactCredentials",
    resolveOobiV2: "/api/v2/resolveOobi",
    keriOobiV2: "/api/v2/keriOobi",
    schemasV2: "/api/v2/schemas",
    schemaByIdV2: "/api/v2/schemas/:id",
    issueAcdcCredentialV2: "/api/v2/issueAcdcCredential",
    deleteContactV2: "/api/v2/deleteContact",
    requestDisclosureV2: "/api/v2/requestDisclosure",
    presentationRequestsV2: "/api/v2/presentationRequests",
    revokeCredentialV2: "/api/v2/revokeCredential",
    deleteRevokedCredentialsV2: "/api/v2/deleteRevokedCredentials",
    notificationsV2: "/api/v2/notifications",
    eventsStreamV2: "/api/v2/events/stream",
    internalFaydaStatus: "/internal/v1/fayda/status",
    internalFaydaIssue: "/internal/v1/fayda/issue",
    internalFaydaDelete: "/internal/v1/fayda",
  },
};
