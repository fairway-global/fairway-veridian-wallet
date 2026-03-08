import { randomUUID } from "crypto";
import { query } from "../db";
import { canonicalSchemaId } from "../consts";
import { TemplateAttribute } from "./dashboardStore.types";
import {
  AccountChangeRequestField,
  AccountChangeRequestRecord,
  AccountChangeRequestStatus,
  AuthRefreshTokenRecord,
  CreateIssuerTemplateInput,
  IssuerCredentialRecord,
  IssuerRecord,
  IssuerSignifyAccountRecord,
  IssuerTemplateRecord,
  IssuerUserRecord,
  IssuerUserWithIssuerRecord,
  ManagedUserRecord,
} from "./tenantStore.types";

function toIso(value: unknown): string {
  return new Date(String(value || new Date().toISOString())).toISOString();
}

function mapIssuerRow(row: Record<string, unknown>): IssuerRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    status: String(row.status),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapIssuerAccountRow(
  row: Record<string, unknown>
): IssuerSignifyAccountRecord {
  return {
    issuerId: String(row.issuer_id),
    branEncrypted: String(row.bran_encrypted),
    aidAlias: String(row.aid_alias),
    aidPrefix: row.aid_prefix ? String(row.aid_prefix) : null,
    registryRegk: row.registry_regk ? String(row.registry_regk) : null,
    qviCredentialId: row.qvi_credential_id
      ? String(row.qvi_credential_id)
      : null,
    initializedAt: row.initialized_at ? toIso(row.initialized_at) : null,
    updatedAt: toIso(row.updated_at),
  };
}

function mapIssuerUserRow(row: Record<string, unknown>): IssuerUserRecord {
  return {
    id: String(row.id),
    issuerId: String(row.issuer_id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    role: String(row.role) as IssuerUserRecord["role"],
    isActive: Boolean(row.is_active),
    createdBy: row.created_by ? String(row.created_by) : null,
    lastLoginAt: row.last_login_at ? toIso(row.last_login_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapIssuerUserWithIssuerRow(
  row: Record<string, unknown>
): IssuerUserWithIssuerRecord {
  return {
    ...mapIssuerUserRow(row),
    issuerCode: String(row.issuer_code || ""),
  };
}

function mapManagedUserRow(row: Record<string, unknown>): ManagedUserRecord {
  return {
    ...mapIssuerUserRow(row),
    issuerCode: String(row.issuer_code || ""),
    issuerName: String(row.issuer_name || ""),
    aidAlias: row.aid_alias ? String(row.aid_alias) : null,
    aidPrefix: row.aid_prefix ? String(row.aid_prefix) : null,
  };
}

function mapAccountChangeRequestRow(
  row: Record<string, unknown>
): AccountChangeRequestRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    issuerId: String(row.issuer_id),
    fieldName: String(row.field_name) as AccountChangeRequestField,
    currentValue: String(row.current_value || ""),
    requestedValue: String(row.requested_value || ""),
    reason: row.reason ? String(row.reason) : null,
    status: String(row.status) as AccountChangeRequestStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    reviewedAt: row.reviewed_at ? toIso(row.reviewed_at) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    adminNote: row.admin_note ? String(row.admin_note) : null,
    userEmail: row.user_email ? String(row.user_email) : undefined,
    userRole: row.user_role ? (String(row.user_role) as IssuerUserRecord["role"]) : undefined,
    issuerCode: row.issuer_code ? String(row.issuer_code) : undefined,
    issuerName: row.issuer_name ? String(row.issuer_name) : undefined,
    reviewedByEmail: row.reviewed_by_email ? String(row.reviewed_by_email) : undefined,
  };
}

function mapRefreshTokenRow(
  row: Record<string, unknown>
): AuthRefreshTokenRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    issuerId: String(row.issuer_id),
    tokenHash: String(row.token_hash),
    expiresAt: toIso(row.expires_at),
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : null,
    replacedBy: row.replaced_by ? String(row.replaced_by) : null,
    createdAt: toIso(row.created_at),
  };
}

function parseTemplateAttributes(value: unknown): TemplateAttribute[] {
  if (Array.isArray(value)) {
    return value as TemplateAttribute[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed as TemplateAttribute[];
      }
    } catch {
      return [];
    }
  }

  return [];
}

function mapTemplateRow(row: Record<string, unknown>): IssuerTemplateRecord {
  return {
    id: String(row.id),
    issuerId: String(row.issuer_id),
    name: String(row.name),
    schemaId: canonicalSchemaId(String(row.schema_id || "").trim()),
    attributes: parseTemplateAttributes(row.attributes),
    autoIssue: Boolean(row.is_auto_issue),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function parseCredentialData(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function mapCredentialRow(row: Record<string, unknown>): IssuerCredentialRecord {
  return {
    id: String(row.id),
    issuerId: String(row.issuer_id),
    templateId: String(row.template_id),
    schemaId: canonicalSchemaId(String(row.schema_id || "").trim()),
    holderDid: String(row.holder_did),
    status: String(row.status) as IssuerCredentialRecord["status"],
    data: parseCredentialData(row.data),
    issuedAt: toIso(row.issued_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : undefined,
    deletedAt: row.deleted_at ? toIso(row.deleted_at) : undefined,
  };
}

export async function getIssuerByCode(code: string): Promise<IssuerRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM issuers WHERE code = $1 LIMIT 1`,
    [String(code || "").trim().toLowerCase()]
  );
  return rows[0] ? mapIssuerRow(rows[0]) : null;
}

export async function getIssuerById(id: string): Promise<IssuerRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM issuers WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ? mapIssuerRow(rows[0]) : null;
}

export async function getIssuerByAidPrefix(
  aidPrefix: string
): Promise<IssuerRecord | null> {
  const normalizedAidPrefix = String(aidPrefix || "").trim();
  if (!normalizedAidPrefix) {
    return null;
  }

  const rows = await query<Record<string, unknown>>(
    `
      SELECT issuers.*
      FROM issuers
      JOIN issuer_signify_accounts
        ON issuer_signify_accounts.issuer_id = issuers.id
      WHERE issuer_signify_accounts.aid_prefix = $1
      LIMIT 1
    `,
    [normalizedAidPrefix]
  );

  return rows[0] ? mapIssuerRow(rows[0]) : null;
}

export async function createIssuer(input: {
  id?: string;
  code: string;
  name: string;
  status?: string;
}): Promise<IssuerRecord> {
  const id = input.id || randomUUID();
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO issuers(id, code, name, status, created_at, updated_at)
      VALUES($1, $2, $3, $4, NOW(), NOW())
      RETURNING *;
    `,
    [
      id,
      String(input.code || "").trim().toLowerCase(),
      String(input.name || "").trim(),
      String(input.status || "active").trim(),
    ]
  );
  return mapIssuerRow(rows[0]);
}

export async function updateIssuerNameById(
  issuerId: string,
  name: string
): Promise<IssuerRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      UPDATE issuers
      SET
        name = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [issuerId, String(name || "").trim()]
  );
  return rows[0] ? mapIssuerRow(rows[0]) : null;
}

export async function upsertIssuerSignifyAccount(input: {
  issuerId: string;
  branEncrypted: string;
  aidAlias: string;
}): Promise<IssuerSignifyAccountRecord> {
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO issuer_signify_accounts(
        issuer_id,
        bran_encrypted,
        aid_alias,
        updated_at
      )
      VALUES($1, $2, $3, NOW())
      ON CONFLICT(issuer_id)
      DO UPDATE SET
        bran_encrypted = EXCLUDED.bran_encrypted,
        aid_alias = EXCLUDED.aid_alias,
        updated_at = NOW()
      RETURNING *;
    `,
    [input.issuerId, input.branEncrypted, String(input.aidAlias || "").trim()]
  );
  return mapIssuerAccountRow(rows[0]);
}

export async function getIssuerSignifyAccountByIssuerId(
  issuerId: string
): Promise<IssuerSignifyAccountRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM issuer_signify_accounts WHERE issuer_id = $1 LIMIT 1`,
    [issuerId]
  );
  return rows[0] ? mapIssuerAccountRow(rows[0]) : null;
}

export async function updateIssuerSignifyRuntime(
  issuerId: string,
  input: {
    aidPrefix?: string;
    registryRegk?: string;
    qviCredentialId?: string;
    initialized?: boolean;
  }
): Promise<void> {
  await query(
    `
      UPDATE issuer_signify_accounts
      SET
        aid_prefix = COALESCE($2, aid_prefix),
        registry_regk = COALESCE($3, registry_regk),
        qvi_credential_id = COALESCE($4, qvi_credential_id),
        initialized_at = CASE
          WHEN $5::boolean IS TRUE AND initialized_at IS NULL THEN NOW()
          ELSE initialized_at
        END,
        updated_at = NOW()
      WHERE issuer_id = $1
    `,
    [
      issuerId,
      input.aidPrefix || null,
      input.registryRegk || null,
      input.qviCredentialId || null,
      Boolean(input.initialized),
    ]
  );
}

export async function listIssuerUsers(issuerId: string): Promise<IssuerUserRecord[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM issuer_users WHERE issuer_id = $1 ORDER BY created_at ASC`,
    [issuerId]
  );
  return rows.map(mapIssuerUserRow);
}

export async function getIssuerUserById(
  issuerId: string,
  userId: string
): Promise<IssuerUserRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM issuer_users WHERE issuer_id = $1 AND id = $2 LIMIT 1`,
    [issuerId, userId]
  );
  return rows[0] ? mapIssuerUserRow(rows[0]) : null;
}

export async function getIssuerUserByEmail(
  issuerId: string,
  email: string
): Promise<IssuerUserRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM issuer_users
      WHERE issuer_id = $1
        AND LOWER(email) = LOWER($2)
      LIMIT 1
    `,
    [issuerId, String(email || "").trim()]
  );
  return rows[0] ? mapIssuerUserRow(rows[0]) : null;
}

export async function listIssuerUsersByEmail(
  email: string
): Promise<IssuerUserWithIssuerRecord[]> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT u.*, i.code AS issuer_code
      FROM issuer_users u
      JOIN issuers i ON i.id = u.issuer_id
      WHERE LOWER(u.email) = LOWER($1)
      ORDER BY u.created_at ASC
    `,
    [String(email || "").trim()]
  );
  return rows.map(mapIssuerUserWithIssuerRow);
}

export async function listManagedUsers(): Promise<ManagedUserRecord[]> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT
        u.*,
        i.code AS issuer_code,
        i.name AS issuer_name,
        s.aid_alias,
        s.aid_prefix
      FROM issuer_users u
      JOIN issuers i ON i.id = u.issuer_id
      LEFT JOIN issuer_signify_accounts s ON s.issuer_id = u.issuer_id
      WHERE u.role IN ('issuer', 'verifier')
      ORDER BY u.created_at DESC
    `
  );
  return rows.map(mapManagedUserRow);
}

export async function getManagedUserById(
  userId: string
): Promise<ManagedUserRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT
        u.*,
        i.code AS issuer_code,
        i.name AS issuer_name,
        s.aid_alias,
        s.aid_prefix
      FROM issuer_users u
      JOIN issuers i ON i.id = u.issuer_id
      LEFT JOIN issuer_signify_accounts s ON s.issuer_id = u.issuer_id
      WHERE u.id = $1
        AND u.role IN ('issuer', 'verifier')
      LIMIT 1
    `,
    [userId]
  );
  return rows[0] ? mapManagedUserRow(rows[0]) : null;
}

export async function createIssuerUser(input: {
  issuerId: string;
  email: string;
  passwordHash: string;
  role: IssuerUserRecord["role"];
  createdBy?: string | null;
  isActive?: boolean;
}): Promise<IssuerUserRecord> {
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO issuer_users(
        id, issuer_id, email, password_hash, role, is_active, created_by, created_at, updated_at
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `,
    [
      randomUUID(),
      input.issuerId,
      String(input.email || "").trim().toLowerCase(),
      input.passwordHash,
      input.role,
      input.isActive ?? true,
      input.createdBy || null,
    ]
  );
  return mapIssuerUserRow(rows[0]);
}

export async function createAccountChangeRequest(input: {
  userId: string;
  issuerId: string;
  fieldName: AccountChangeRequestField;
  currentValue: string;
  requestedValue: string;
  reason?: string | null;
}): Promise<AccountChangeRequestRecord> {
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO account_change_requests(
        id,
        user_id,
        issuer_id,
        field_name,
        current_value,
        requested_value,
        reason,
        status,
        created_at,
        updated_at
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())
      RETURNING *
    `,
    [
      randomUUID(),
      input.userId,
      input.issuerId,
      input.fieldName,
      String(input.currentValue || ""),
      String(input.requestedValue || ""),
      input.reason ? String(input.reason).trim() : null,
    ]
  );
  return mapAccountChangeRequestRow(rows[0]);
}

export async function listAccountChangeRequests(input?: {
  userId?: string;
  status?: AccountChangeRequestStatus;
}): Promise<AccountChangeRequestRecord[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (input?.userId) {
    params.push(input.userId);
    clauses.push(`r.user_id = $${params.length}`);
  }
  if (input?.status) {
    params.push(input.status);
    clauses.push(`r.status = $${params.length}`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await query<Record<string, unknown>>(
    `
      SELECT
        r.*,
        u.email AS user_email,
        u.role AS user_role,
        i.code AS issuer_code,
        i.name AS issuer_name,
        reviewer.email AS reviewed_by_email
      FROM account_change_requests r
      JOIN issuer_users u ON u.id = r.user_id
      JOIN issuers i ON i.id = r.issuer_id
      LEFT JOIN issuer_users reviewer ON reviewer.id = r.reviewed_by
      ${whereClause}
      ORDER BY r.created_at DESC
    `,
    params
  );
  return rows.map(mapAccountChangeRequestRow);
}

export async function getAccountChangeRequestById(
  id: string
): Promise<AccountChangeRequestRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT
        r.*,
        u.email AS user_email,
        u.role AS user_role,
        i.code AS issuer_code,
        i.name AS issuer_name,
        reviewer.email AS reviewed_by_email
      FROM account_change_requests r
      JOIN issuer_users u ON u.id = r.user_id
      JOIN issuers i ON i.id = r.issuer_id
      LEFT JOIN issuer_users reviewer ON reviewer.id = r.reviewed_by
      WHERE r.id = $1
      LIMIT 1
    `,
    [id]
  );
  return rows[0] ? mapAccountChangeRequestRow(rows[0]) : null;
}

export async function updateAccountChangeRequestStatus(input: {
  id: string;
  status: AccountChangeRequestStatus;
  reviewedBy: string;
  adminNote?: string | null;
}): Promise<AccountChangeRequestRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      UPDATE account_change_requests
      SET
        status = $2,
        reviewed_by = $3,
        reviewed_at = NOW(),
        admin_note = $4,
        updated_at = NOW()
      WHERE id = $1
        AND status = 'pending'
      RETURNING *
    `,
    [input.id, input.status, input.reviewedBy, input.adminNote || null]
  );
  return rows[0] ? mapAccountChangeRequestRow(rows[0]) : null;
}

export async function updateIssuerUser(
  issuerId: string,
  userId: string,
  input: {
    email?: string;
    passwordHash?: string;
    role?: IssuerUserRecord["role"];
    isActive?: boolean;
  }
): Promise<IssuerUserRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      UPDATE issuer_users
      SET
        password_hash = COALESCE($3, password_hash),
        role = COALESCE($4, role),
        is_active = COALESCE($5, is_active),
        email = COALESCE($6, email),
        updated_at = NOW()
      WHERE issuer_id = $1 AND id = $2
      RETURNING *
    `,
    [
      issuerId,
      userId,
      input.passwordHash || null,
      input.role || null,
      typeof input.isActive === "boolean" ? input.isActive : null,
      input.email ? String(input.email).trim().toLowerCase() : null,
    ]
  );
  return rows[0] ? mapIssuerUserRow(rows[0]) : null;
}

export async function updateIssuerUserLastLogin(userId: string): Promise<void> {
  await query(
    `
      UPDATE issuer_users
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `,
    [userId]
  );
}

export async function createRefreshTokenRecord(input: {
  id: string;
  userId: string;
  issuerId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<AuthRefreshTokenRecord> {
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO auth_refresh_tokens(
        id, user_id, issuer_id, token_hash, expires_at, created_at
      )
      VALUES($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `,
    [input.id, input.userId, input.issuerId, input.tokenHash, input.expiresAt]
  );
  return mapRefreshTokenRow(rows[0]);
}

export async function getRefreshTokenRecordByHash(
  tokenHash: string
): Promise<AuthRefreshTokenRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM auth_refresh_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );
  return rows[0] ? mapRefreshTokenRow(rows[0]) : null;
}

export async function revokeRefreshTokenById(id: string): Promise<void> {
  await query(
    `
      UPDATE auth_refresh_tokens
      SET revoked_at = NOW()
      WHERE id = $1 AND revoked_at IS NULL
    `,
    [id]
  );
}

export async function replaceRefreshToken(
  oldTokenId: string,
  newTokenId: string
): Promise<void> {
  await query(
    `
      UPDATE auth_refresh_tokens
      SET revoked_at = NOW(), replaced_by = $2
      WHERE id = $1
    `,
    [oldTokenId, newTokenId]
  );
}

export async function insertGatewayTokenJti(input: {
  jti: string;
  issuerId: string;
  scope: string;
  expiresAt: Date;
}): Promise<boolean> {
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO gateway_token_jti(jti, issuer_id, scope, expires_at, created_at)
      VALUES($1, $2, $3, $4, NOW())
      ON CONFLICT(jti) DO NOTHING
      RETURNING jti
    `,
    [input.jti, input.issuerId, input.scope, input.expiresAt]
  );
  return Boolean(rows.length);
}

export async function cleanupExpiredGatewayTokenJti(): Promise<void> {
  await query(`DELETE FROM gateway_token_jti WHERE expires_at < NOW()`);
}

export async function listTemplatesByIssuer(
  issuerId: string
): Promise<IssuerTemplateRecord[]> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM templates
      WHERE issuer_id = $1
      ORDER BY created_at ASC
    `,
    [issuerId]
  );
  return rows.map(mapTemplateRow);
}

export async function getTemplateByIdForIssuer(
  issuerId: string,
  templateId: string
): Promise<IssuerTemplateRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM templates
      WHERE issuer_id = $1 AND id = $2
      LIMIT 1
    `,
    [issuerId, templateId]
  );
  return rows[0] ? mapTemplateRow(rows[0]) : null;
}

export async function getAutoIssueTemplateByIssuer(
  issuerId: string
): Promise<IssuerTemplateRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM templates
      WHERE issuer_id = $1 AND is_auto_issue = TRUE
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [issuerId]
  );
  return rows[0] ? mapTemplateRow(rows[0]) : null;
}

export async function createTemplateForIssuer(
  input: CreateIssuerTemplateInput
): Promise<IssuerTemplateRecord> {
  const autoIssue = Boolean(input.autoIssue);
  if (autoIssue) {
    await query(
      `
        UPDATE templates
        SET is_auto_issue = FALSE, updated_at = NOW()
        WHERE issuer_id = $1 AND is_auto_issue = TRUE
      `,
      [input.issuerId]
    );
  }

  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO templates(
        id, issuer_id, name, schema_id, attributes, is_auto_issue, created_at, updated_at
      )
      VALUES($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `,
    [
      randomUUID(),
      input.issuerId,
      String(input.name || "").trim(),
      canonicalSchemaId(String(input.schemaId || "").trim()),
      JSON.stringify(input.attributes || []),
      autoIssue,
    ]
  );
  return mapTemplateRow(rows[0]);
}

export async function updateTemplateForIssuer(
  issuerId: string,
  templateId: string,
  input: {
    name: string;
    schemaId: string;
    attributes: TemplateAttribute[];
    autoIssue: boolean;
  }
): Promise<IssuerTemplateRecord | null> {
  if (input.autoIssue) {
    await query(
      `
        UPDATE templates
        SET is_auto_issue = FALSE, updated_at = NOW()
        WHERE issuer_id = $1 AND id <> $2 AND is_auto_issue = TRUE
      `,
      [issuerId, templateId]
    );
  }

  const rows = await query<Record<string, unknown>>(
    `
      UPDATE templates
      SET
        name = $3,
        schema_id = $4,
        attributes = $5,
        is_auto_issue = $6,
        updated_at = NOW()
      WHERE issuer_id = $1 AND id = $2
      RETURNING *
    `,
    [
      issuerId,
      templateId,
      String(input.name || "").trim(),
      canonicalSchemaId(String(input.schemaId || "").trim()),
      JSON.stringify(input.attributes || []),
      Boolean(input.autoIssue),
    ]
  );
  return rows[0] ? mapTemplateRow(rows[0]) : null;
}

export async function deleteTemplateForIssuer(
  issuerId: string,
  templateId: string
): Promise<boolean> {
  const rows = await query<Record<string, unknown>>(
    `
      DELETE FROM templates
      WHERE issuer_id = $1 AND id = $2
      RETURNING id
    `,
    [issuerId, templateId]
  );
  return Boolean(rows.length);
}

export async function findTemplateBySchemaIdForIssuer(
  issuerId: string,
  schemaId: string
): Promise<IssuerTemplateRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM templates
      WHERE issuer_id = $1 AND schema_id = $2
      LIMIT 1
    `,
    [issuerId, canonicalSchemaId(String(schemaId || "").trim())]
  );
  return rows[0] ? mapTemplateRow(rows[0]) : null;
}

export async function listIssuedCredentialsByIssuer(
  issuerId: string
): Promise<IssuerCredentialRecord[]> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM credentials
      WHERE issuer_id = $1
      ORDER BY issued_at DESC
    `,
    [issuerId]
  );
  return rows.map(mapCredentialRow);
}

export async function getIssuedCredentialByIdForIssuer(
  issuerId: string,
  credentialId: string
): Promise<IssuerCredentialRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM credentials
      WHERE issuer_id = $1 AND id = $2
      LIMIT 1
    `,
    [issuerId, credentialId]
  );
  return rows[0] ? mapCredentialRow(rows[0]) : null;
}

export async function upsertIssuedCredentialForIssuer(input: {
  id: string;
  issuerId: string;
  templateId: string;
  schemaId: string;
  holderDid: string;
  status: IssuerCredentialRecord["status"];
  data: Record<string, unknown>;
  issuedAt: string;
  revokedAt?: string;
  deletedAt?: string;
}): Promise<IssuerCredentialRecord> {
  const rows = await query<Record<string, unknown>>(
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
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT(id)
      DO UPDATE SET
        issuer_id = EXCLUDED.issuer_id,
        template_id = EXCLUDED.template_id,
        schema_id = EXCLUDED.schema_id,
        holder_did = EXCLUDED.holder_did,
        status = EXCLUDED.status,
        data = EXCLUDED.data,
        issued_at = EXCLUDED.issued_at,
        revoked_at = EXCLUDED.revoked_at,
        deleted_at = EXCLUDED.deleted_at,
        updated_at = NOW()
      RETURNING *
    `,
    [
      input.id,
      input.issuerId,
      input.templateId,
      canonicalSchemaId(String(input.schemaId || "").trim()),
      input.holderDid,
      input.status,
      JSON.stringify(input.data || {}),
      input.issuedAt,
      input.revokedAt || null,
      input.deletedAt || null,
    ]
  );
  return mapCredentialRow(rows[0]);
}

export async function markIssuedCredentialStatusForIssuer(
  issuerId: string,
  credentialId: string,
  status: IssuerCredentialRecord["status"]
): Promise<IssuerCredentialRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      UPDATE credentials
      SET
        status = $3,
        revoked_at = CASE WHEN $3 = 'revoked' THEN NOW() ELSE revoked_at END,
        deleted_at = CASE WHEN $3 = 'deleted' THEN NOW() ELSE deleted_at END,
        updated_at = NOW()
      WHERE issuer_id = $1 AND id = $2
      RETURNING *
    `,
    [issuerId, credentialId, status]
  );
  return rows[0] ? mapCredentialRow(rows[0]) : null;
}
