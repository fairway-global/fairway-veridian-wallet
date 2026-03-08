import { existsSync, readFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  createIssuer,
  createIssuerUser,
  getIssuerByCode,
  getIssuerSignifyAccountByIssuerId,
  getIssuerUserByEmail,
  upsertIssuerSignifyAccount,
} from "./tenantStore";
import { encryptSecret } from "./cryptoService";
import { hashPassword } from "./authService";
import { config } from "../config";
import { query } from "../db";

interface LegacyDashboardDbFile {
  templates?: Array<{
    id: string;
    name: string;
    schemaId: string;
    attributes: unknown[];
    createdAt: string;
    updatedAt: string;
  }>;
  credentials?: Array<{
    id: string;
    templateId: string;
    schemaId: string;
    holderDid: string;
    status: string;
    data: Record<string, unknown>;
    issuedAt: string;
    createdAt: string;
    updatedAt: string;
    revokedAt?: string;
    deletedAt?: string;
  }>;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function normalizeCredentialStatus(value: unknown): "issued" | "revoked" | "deleted" {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "revoked" || normalized === "deleted") {
    return normalized;
  }

  return "issued";
}

function findLegacyDashboardDbPath(): string | null {
  const candidates = [
    path.resolve(__dirname, "../../data/dashboard-db.json"),
    path.resolve(process.cwd(), "data/dashboard-db.json"),
    path.resolve(process.cwd(), "services/credential-server/data/dashboard-db.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function backfillIssuerId(issuerId: string): Promise<void> {
  await query(`UPDATE templates SET issuer_id = $1 WHERE issuer_id IS NULL`, [
    issuerId,
  ]);
  await query(`UPDATE credentials SET issuer_id = $1 WHERE issuer_id IS NULL`, [
    issuerId,
  ]);
}

async function importLegacyDashboardDb(issuerId: string): Promise<void> {
  const dbPath = findLegacyDashboardDbPath();
  if (!dbPath) {
    return;
  }

  const existingTemplateRows = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM templates WHERE issuer_id = $1`,
    [issuerId]
  );
  const totalTemplates = Number(existingTemplateRows[0]?.total || "0");
  if (totalTemplates > 0) {
    return;
  }

  let parsed: LegacyDashboardDbFile | null = null;
  try {
    const content = readFileSync(dbPath, "utf8");
    parsed = JSON.parse(content) as LegacyDashboardDbFile;
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return;
  }

  const templateIdMap = new Map<string, string>();

  for (const template of parsed.templates || []) {
    const legacyTemplateId = String(template.id || "").trim();
    const persistedTemplateId = isUuid(legacyTemplateId)
      ? legacyTemplateId
      : randomUUID();
    if (legacyTemplateId) {
      templateIdMap.set(legacyTemplateId, persistedTemplateId);
    }

    await query(
      `
        INSERT INTO templates(
          id, issuer_id, name, schema_id, attributes, created_at, updated_at
        )
        VALUES($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(id) DO NOTHING
      `,
      [
        persistedTemplateId,
        issuerId,
        String(template.name || "").trim(),
        String(template.schemaId || "").trim(),
        JSON.stringify(Array.isArray(template.attributes) ? template.attributes : []),
        template.createdAt || new Date().toISOString(),
        template.updatedAt || new Date().toISOString(),
      ]
    );
  }

  for (const credential of parsed.credentials || []) {
    const legacyCredentialId = String(credential.id || "").trim();
    const persistedCredentialId = isUuid(legacyCredentialId)
      ? legacyCredentialId
      : randomUUID();

    const legacyTemplateId = String(credential.templateId || "").trim();
    const persistedTemplateId =
      templateIdMap.get(legacyTemplateId) ||
      (isUuid(legacyTemplateId) ? legacyTemplateId : "");
    if (!persistedTemplateId) {
      continue;
    }

    const holderDid = String(credential.holderDid || "").trim();
    if (!holderDid) {
      continue;
    }

    await query(
      `
        INSERT INTO credentials(
          id,
          issuer_id,
          template_id,
          schema_id,
          holder_did,
          status,
          data,
          issued_at,
          revoked_at,
          deleted_at,
          created_at,
          updated_at
        )
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT(id) DO NOTHING
      `,
      [
        persistedCredentialId,
        issuerId,
        persistedTemplateId,
        String(credential.schemaId || "").trim(),
        holderDid,
        normalizeCredentialStatus(credential.status),
        JSON.stringify(credential.data || {}),
        credential.issuedAt || new Date().toISOString(),
        credential.revokedAt || null,
        credential.deletedAt || null,
        credential.createdAt || new Date().toISOString(),
        credential.updatedAt || new Date().toISOString(),
      ]
    );
  }
}

export async function bootstrapDefaultIssuer(input: {
  defaultIssuerBran: string;
}): Promise<void> {
  const issuerCode = String(config.defaultIssuerCode || "default")
    .trim()
    .toLowerCase();
  const issuerName = String(config.defaultIssuerName || "Default Issuer").trim();
  const adminEmail = String(config.defaultAdminEmail || "").trim().toLowerCase();
  const adminPassword = String(config.defaultAdminPassword || "");
  const issuerUserEmail = String(config.defaultIssuerUserEmail || "")
    .trim()
    .toLowerCase();
  const issuerUserPassword = String(config.defaultIssuerUserPassword || "");
  const verifierEmail = String(config.defaultVerifierEmail || "")
    .trim()
    .toLowerCase();
  const verifierPassword = String(config.defaultVerifierPassword || "");

  let issuer = await getIssuerByCode(issuerCode);
  if (!issuer) {
    issuer = await createIssuer({
      code: issuerCode,
      name: issuerName,
      status: "active",
    });
  }

  const existingSignifyAccount = await getIssuerSignifyAccountByIssuerId(
    issuer.id
  );
  if (!existingSignifyAccount) {
    await upsertIssuerSignifyAccount({
      issuerId: issuer.id,
      branEncrypted: encryptSecret(input.defaultIssuerBran),
      aidAlias: String(config.defaultIssuerAidAlias || "").trim(),
    });
  }

  await backfillIssuerId(issuer.id);
  await importLegacyDashboardDb(issuer.id);

  if (adminEmail && adminPassword) {
    const existingAdmin = await getIssuerUserByEmail(issuer.id, adminEmail);
    if (!existingAdmin) {
      const passwordHash = await hashPassword(adminPassword);
      await createIssuerUser({
        issuerId: issuer.id,
        email: adminEmail,
        passwordHash,
        role: "admin",
      });
    }
  }

  if (issuerUserEmail && issuerUserPassword) {
    const existingIssuerUser = await getIssuerUserByEmail(issuer.id, issuerUserEmail);
    if (!existingIssuerUser) {
      const passwordHash = await hashPassword(issuerUserPassword);
      await createIssuerUser({
        issuerId: issuer.id,
        email: issuerUserEmail,
        passwordHash,
        role: "issuer",
      });
    }
  }

  if (verifierEmail && verifierPassword) {
    const existingVerifier = await getIssuerUserByEmail(issuer.id, verifierEmail);
    if (!existingVerifier) {
      const passwordHash = await hashPassword(verifierPassword);
      await createIssuerUser({
        issuerId: issuer.id,
        email: verifierEmail,
        passwordHash,
        role: "verifier",
      });
    }
  }
}
