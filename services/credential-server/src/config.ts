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

export const config = {
  endpoint: endpoint,
  oobiEndpoint: oobiEndpoint,
  port,
  jsonBodyLimit,
  dashboardApiToken,
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
  },
};
