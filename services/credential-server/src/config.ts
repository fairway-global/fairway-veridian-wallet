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
const gatewayJwtSecret =
  process.env.GATEWAY_JWT_SECRET ?? "dev-change-me-gateway-secret";
const gatewayJwtIssuer =
  process.env.GATEWAY_JWT_ISSUER ?? "fairway-backend-gateway";
const gatewayJwtAudience =
  process.env.GATEWAY_JWT_AUDIENCE ?? "credential-server-internal";
const accessTokenTtlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900);
const refreshTokenTtlSeconds = Number(
  process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30
);
const gatewayTokenMaxAgeSeconds = Number(
  process.env.GATEWAY_TOKEN_MAX_AGE_SECONDS || 300
);
const branEncryptionKey =
  process.env.BRAN_ENCRYPTION_KEY ?? "dev-change-me-bran-encryption-key";
const defaultIssuerCode = process.env.DEFAULT_ISSUER_CODE ?? "default";
const defaultIssuerName = process.env.DEFAULT_ISSUER_NAME ?? "Default Issuer";
const defaultIssuerAidAlias =
  process.env.DEFAULT_ISSUER_AID_ALIAS ?? "issuer";
const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@default.local";
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
  gatewayJwtSecret,
  gatewayJwtIssuer,
  gatewayJwtAudience,
  accessTokenTtlSeconds,
  refreshTokenTtlSeconds,
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
  keria: {
    url: keriaUrl,
    bootUrl: keriaBootUrl,
  },
  path: {
    ping: "/ping",
    keriOobi: "/keriOobi",
    saveFayda: "/saveFayda",
    issueAcdcCredential: "/issueAcdcCredential",
    saveFaydaData: "/saveFaydaData",
    saveData: "/saveData",
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
    authRefreshV2: "/api/v2/auth/refresh",
    authLogoutV2: "/api/v2/auth/logout",
    authMeV2: "/api/v2/auth/me",
    usersV2: "/api/v2/users",
    userByIdV2: "/api/v2/users/:id",
    adminUsersV2: "/api/v2/admin/users",
    adminUserByIdV2: "/api/v2/admin/users/:id",
    adminRequestsV2: "/api/v2/admin/requests",
    adminRequestByIdV2: "/api/v2/admin/requests/:id",
    accountProfileV2: "/api/v2/account/profile",
    accountRequestsV2: "/api/v2/account/requests",
    templatesV2: "/api/v2/templates",
    templateByIdV2: "/api/v2/templates/:id",
    credentialsApiV2: "/api/v2/credentials",
    credentialByIdV2: "/api/v2/credentials/:id",
    issueCredentialApiV2: "/api/v2/credentials/issue",
    revokeCredentialApiV2: "/api/v2/credentials/:id/revoke",
    deleteCredentialApiV2: "/api/v2/credentials/:id",
    contactsV2: "/api/v2/contacts",
    contactCredentialsV2: "/api/v2/contactCredentials",
    resolveOobiV2: "/api/v2/resolveOobi",
    keriOobiV2: "/api/v2/keriOobi",
    schemasV2: "/api/v2/schemas",
    issueAcdcCredentialV2: "/api/v2/issueAcdcCredential",
    deleteContactV2: "/api/v2/deleteContact",
    requestDisclosureV2: "/api/v2/requestDisclosure",
    revokeCredentialV2: "/api/v2/revokeCredential",
    deleteRevokedCredentialsV2: "/api/v2/deleteRevokedCredentials",
    notificationsV2: "/api/v2/notifications",
    eventsStreamV2: "/api/v2/events/stream",
    internalFaydaStatus: "/internal/v1/fayda/status",
    internalFaydaIssue: "/internal/v1/fayda/issue",
    internalFaydaDelete: "/internal/v1/fayda",
  },
};
