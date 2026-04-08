import { randomUUID } from "crypto";
import { query } from "../db";
import { canonicalSchemaId } from "../consts";
import { TemplateAttribute } from "./dashboardStore.types";
import {
  AccountChangeRequestField,
  AccountChangeRequestRecord,
  AccountChangeRequestStatus,
  AuthPasswordResetTokenRecord,
  AuthRefreshTokenRecord,
  CreateIssuerTemplateInput,
  IssuerCredentialRecord,
  IssuerApplicationRequestRecord,
  IssuerApplicationRequestStatus,
  IssuerFaydaVerificationRecord,
  IssuerRecord,
  IssuerSignifyAccountRecord,
  IssuerTemplateRecord,
  IssuerUserRecord,
  IssuerUserWithIssuerRecord,
  ManagedUserRecord,
  PresentationRequestRecord,
  SchemaRegistryRecord,
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

function mapIssuerApplicationRequestRow(
  row: Record<string, unknown>
): IssuerApplicationRequestRecord {
  return {
    id: String(row.id),
    organizationName: String(row.organization_name || ""),
    organizationType: row.organization_type
      ? String(row.organization_type)
      : null,
    contactName: String(row.contact_name || ""),
    email: String(row.email || ""),
    phoneNumber: row.phone_number ? String(row.phone_number) : null,
    country: row.country ? String(row.country) : null,
    website: row.website ? String(row.website) : null,
    credentialUseCase: String(row.credential_use_case || ""),
    expectedVolume: row.expected_volume ? String(row.expected_volume) : null,
    notes: row.notes ? String(row.notes) : null,
    status: String(row.status) as IssuerApplicationRequestStatus,
    reviewedAt: row.reviewed_at ? toIso(row.reviewed_at) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    adminNote: row.admin_note ? String(row.admin_note) : null,
    provisionedUserId: row.provisioned_user_id
      ? String(row.provisioned_user_id)
      : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    reviewedByEmail: row.reviewed_by_email
      ? String(row.reviewed_by_email)
      : undefined,
    provisionedUserEmail: row.provisioned_user_email
      ? String(row.provisioned_user_email)
      : undefined,
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

function mapPasswordResetTokenRow(
  row: Record<string, unknown>
): AuthPasswordResetTokenRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    issuerId: String(row.issuer_id),
    tokenHash: String(row.token_hash),
    expiresAt: toIso(row.expires_at),
    usedAt: row.used_at ? toIso(row.used_at) : null,
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

function mapSchemaRegistryRow(
  row: Record<string, unknown>
): SchemaRegistryRecord {
  return {
    schemaId: canonicalSchemaId(String(row.schema_id || "").trim()),
    ownerIssuerId: row.owner_issuer_id ? String(row.owner_issuer_id) : null,
    isPublic: Boolean(row.is_public),
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

function parseStringRecord(value: unknown): Record<string, string> {
  const parsed = parseCredentialData(value);
  return Object.fromEntries(
    Object.entries(parsed).map(([key, item]) => [key, String(item ?? "")])
  );
}

function parseBooleanRecord(value: unknown): Record<string, boolean> {
  const parsed = parseCredentialData(value);
  return Object.fromEntries(
    Object.entries(parsed).map(([key, item]) => [key, Boolean(item)])
  );
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

function mapPresentationRequestRow(
  row: Record<string, unknown>
): PresentationRequestRecord {
  return {
    id: String(row.id),
    issuerId: String(row.issuer_id),
    requestExnSaid: String(row.request_exn_said || ""),
    verifierDid: String(row.verifier_did || ""),
    holderDid: String(row.holder_did || ""),
    schemaId: canonicalSchemaId(String(row.schema_id || "").trim()),
    requestedAttributes: parseStringRecord(row.requested_attributes),
    status: String(row.status) as PresentationRequestRecord["status"],
    offerExnSaid: row.offer_exn_said ? String(row.offer_exn_said) : null,
    agreeExnSaid: row.agree_exn_said ? String(row.agree_exn_said) : null,
    grantExnSaid: row.grant_exn_said ? String(row.grant_exn_said) : null,
    presentedCredentialId: row.presented_credential_id
      ? String(row.presented_credential_id)
      : null,
    presentedIssuerDid: row.presented_issuer_did
      ? String(row.presented_issuer_did)
      : null,
    presentedHolderDid: row.presented_holder_did
      ? String(row.presented_holder_did)
      : null,
    presentedAttributes: parseCredentialData(row.presented_attributes),
    verificationChecks: parseBooleanRecord(row.verification_checks),
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    requestedAt: toIso(row.requested_at),
    presentedAt: row.presented_at ? toIso(row.presented_at) : null,
    verifiedAt: row.verified_at ? toIso(row.verified_at) : null,
    completedAt: row.completed_at ? toIso(row.completed_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
}

function mapFaydaVerificationRow(
  row: Record<string, unknown>
): IssuerFaydaVerificationRecord {
  return {
    id: String(row.id),
    issuerId: String(row.issuer_id),
    holderAid: String(row.holder_aid),
    faydaId: String(row.fayda_id || ""),
    templateId: row.template_id ? String(row.template_id) : null,
    credentialId: row.credential_id ? String(row.credential_id) : null,
    status: String(row.status) as IssuerFaydaVerificationRecord["status"],
    missingFields: parseStringArray(row.missing_fields),
    mappedData: parseCredentialData(row.mapped_data),
    faydaData: parseCredentialData(row.fayda_data),
    verifiedAt: toIso(row.verified_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
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

export async function createIssuerApplicationRequest(input: {
  organizationName: string;
  organizationType?: string | null;
  contactName: string;
  email: string;
  phoneNumber?: string | null;
  country?: string | null;
  website?: string | null;
  credentialUseCase: string;
  expectedVolume?: string | null;
  notes?: string | null;
}): Promise<IssuerApplicationRequestRecord> {
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO issuer_application_requests(
        id,
        organization_name,
        organization_type,
        contact_name,
        email,
        phone_number,
        country,
        website,
        credential_use_case,
        expected_volume,
        notes,
        status,
        created_at,
        updated_at
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW(), NOW())
      RETURNING *
    `,
    [
      randomUUID(),
      String(input.organizationName || "").trim(),
      input.organizationType ? String(input.organizationType).trim() : null,
      String(input.contactName || "").trim(),
      String(input.email || "").trim().toLowerCase(),
      input.phoneNumber ? String(input.phoneNumber).trim() : null,
      input.country ? String(input.country).trim() : null,
      input.website ? String(input.website).trim() : null,
      String(input.credentialUseCase || "").trim(),
      input.expectedVolume ? String(input.expectedVolume).trim() : null,
      input.notes ? String(input.notes).trim() : null,
    ]
  );

  return mapIssuerApplicationRequestRow(rows[0]);
}

export async function getPendingIssuerApplicationRequestByEmail(
  email: string
): Promise<IssuerApplicationRequestRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT
        r.*,
        reviewer.email AS reviewed_by_email,
        provisioned.email AS provisioned_user_email
      FROM issuer_application_requests r
      LEFT JOIN issuer_users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN issuer_users provisioned ON provisioned.id = r.provisioned_user_id
      WHERE LOWER(r.email) = LOWER($1)
        AND r.status = 'pending'
      LIMIT 1
    `,
    [String(email || "").trim()]
  );

  return rows[0] ? mapIssuerApplicationRequestRow(rows[0]) : null;
}

export async function listIssuerApplicationRequests(input?: {
  status?: IssuerApplicationRequestStatus;
}): Promise<IssuerApplicationRequestRecord[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (input?.status) {
    params.push(input.status);
    clauses.push(`r.status = $${params.length}`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await query<Record<string, unknown>>(
    `
      SELECT
        r.*,
        reviewer.email AS reviewed_by_email,
        provisioned.email AS provisioned_user_email
      FROM issuer_application_requests r
      LEFT JOIN issuer_users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN issuer_users provisioned ON provisioned.id = r.provisioned_user_id
      ${whereClause}
      ORDER BY r.created_at DESC
    `,
    params
  );

  return rows.map(mapIssuerApplicationRequestRow);
}

export async function getIssuerApplicationRequestById(
  id: string
): Promise<IssuerApplicationRequestRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT
        r.*,
        reviewer.email AS reviewed_by_email,
        provisioned.email AS provisioned_user_email
      FROM issuer_application_requests r
      LEFT JOIN issuer_users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN issuer_users provisioned ON provisioned.id = r.provisioned_user_id
      WHERE r.id = $1
      LIMIT 1
    `,
    [id]
  );

  return rows[0] ? mapIssuerApplicationRequestRow(rows[0]) : null;
}

export async function updateIssuerApplicationRequestStatus(input: {
  id: string;
  status: IssuerApplicationRequestStatus;
  reviewedBy: string;
  adminNote?: string | null;
  provisionedUserId?: string | null;
}): Promise<IssuerApplicationRequestRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      UPDATE issuer_application_requests
      SET
        status = $2,
        reviewed_by = $3,
        reviewed_at = NOW(),
        admin_note = $4,
        provisioned_user_id = COALESCE($5, provisioned_user_id),
        updated_at = NOW()
      WHERE id = $1
        AND status = 'pending'
      RETURNING *
    `,
    [
      input.id,
      input.status,
      input.reviewedBy,
      input.adminNote || null,
      input.provisionedUserId || null,
    ]
  );

  return rows[0] ? mapIssuerApplicationRequestRow(rows[0]) : null;
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

export async function revokeRefreshTokensByUserId(userId: string): Promise<void> {
  await query(
    `
      UPDATE auth_refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL
    `,
    [userId]
  );
}

export async function createPasswordResetTokenRecord(input: {
  id: string;
  userId: string;
  issuerId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<AuthPasswordResetTokenRecord> {
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO auth_password_reset_tokens(
        id, user_id, issuer_id, token_hash, expires_at, created_at
      )
      VALUES($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `,
    [input.id, input.userId, input.issuerId, input.tokenHash, input.expiresAt]
  );
  return mapPasswordResetTokenRow(rows[0]);
}

export async function getPasswordResetTokenRecordByHash(
  tokenHash: string
): Promise<AuthPasswordResetTokenRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM auth_password_reset_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );
  return rows[0] ? mapPasswordResetTokenRow(rows[0]) : null;
}

export async function markPasswordResetTokenUsed(id: string): Promise<void> {
  await query(
    `
      UPDATE auth_password_reset_tokens
      SET used_at = NOW()
      WHERE id = $1 AND used_at IS NULL
    `,
    [id]
  );
}

export async function revokePasswordResetTokensByUserId(
  userId: string
): Promise<void> {
  await query(
    `
      UPDATE auth_password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = $1 AND used_at IS NULL
    `,
    [userId]
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

export async function getSchemaRegistryById(
  schemaId: string
): Promise<SchemaRegistryRecord | null> {
  const normalizedSchemaId = canonicalSchemaId(String(schemaId || "").trim());
  if (!normalizedSchemaId) {
    return null;
  }

  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM schema_registry
      WHERE schema_id = $1
      LIMIT 1
    `,
    [normalizedSchemaId]
  );

  return rows[0] ? mapSchemaRegistryRow(rows[0]) : null;
}

export async function listSchemaRegistryByIds(
  schemaIds: string[]
): Promise<SchemaRegistryRecord[]> {
  const normalizedSchemaIds = Array.from(
    new Set(
      (Array.isArray(schemaIds) ? schemaIds : [])
        .map((schemaId) => canonicalSchemaId(String(schemaId || "").trim()))
        .filter(Boolean)
    )
  );

  if (!normalizedSchemaIds.length) {
    return [];
  }

  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM schema_registry
      WHERE schema_id = ANY($1::varchar[])
    `,
    [normalizedSchemaIds]
  );

  return rows.map(mapSchemaRegistryRow);
}

export async function upsertSchemaRegistry(input: {
  schemaId: string;
  ownerIssuerId?: string | null;
  isPublic: boolean;
}): Promise<SchemaRegistryRecord> {
  const normalizedSchemaId = canonicalSchemaId(String(input.schemaId || "").trim());
  if (!normalizedSchemaId) {
    throw new Error("Schema id is required");
  }

  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO schema_registry(
        schema_id,
        owner_issuer_id,
        is_public,
        created_at,
        updated_at
      )
      VALUES($1, $2, $3, NOW(), NOW())
      ON CONFLICT(schema_id)
      DO UPDATE SET
        owner_issuer_id = COALESCE(
          schema_registry.owner_issuer_id,
          EXCLUDED.owner_issuer_id
        ),
        is_public = EXCLUDED.is_public,
        updated_at = NOW()
      RETURNING *
    `,
    [
      normalizedSchemaId,
      input.ownerIssuerId ? String(input.ownerIssuerId).trim() : null,
      Boolean(input.isPublic),
    ]
  );

  return mapSchemaRegistryRow(rows[0]);
}

export async function listReferencedSchemaIdsForIssuer(
  issuerId: string,
  schemaIds?: string[]
): Promise<string[]> {
  const normalizedSchemaIds = Array.from(
    new Set(
      (Array.isArray(schemaIds) ? schemaIds : [])
        .map((schemaId) => canonicalSchemaId(String(schemaId || "").trim()))
        .filter(Boolean)
    )
  );

  const params: unknown[] = [issuerId];
  const filterClause = normalizedSchemaIds.length
    ? `
      WHERE schema_id = ANY($2::varchar[])
    `
    : "";

  if (normalizedSchemaIds.length) {
    params.push(normalizedSchemaIds);
  }

  const rows = await query<Record<string, unknown>>(
    `
      SELECT DISTINCT schema_id
      FROM (
        SELECT schema_id
        FROM templates
        WHERE issuer_id = $1
        UNION
        SELECT schema_id
        FROM credentials
        WHERE issuer_id = $1
        UNION
        SELECT schema_id
        FROM presentation_requests
        WHERE issuer_id = $1
      ) AS issuer_schema_ids
      ${filterClause}
    `,
    params
  );

  return Array.from(
    new Set(
      rows
        .map((row) => canonicalSchemaId(String(row.schema_id || "").trim()))
        .filter(Boolean)
    )
  );
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

export async function listPresentationRequestsByIssuer(
  issuerId: string
): Promise<PresentationRequestRecord[]> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM presentation_requests
      WHERE issuer_id = $1
      ORDER BY requested_at DESC, created_at DESC
    `,
    [issuerId]
  );
  return rows.map(mapPresentationRequestRow);
}

export async function getPresentationRequestByIdForIssuer(
  issuerId: string,
  requestId: string
): Promise<PresentationRequestRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM presentation_requests
      WHERE issuer_id = $1 AND id = $2
      LIMIT 1
    `,
    [issuerId, requestId]
  );
  return rows[0] ? mapPresentationRequestRow(rows[0]) : null;
}

export async function getPresentationRequestByRequestExnSaidForIssuer(
  issuerId: string,
  requestExnSaid: string
): Promise<PresentationRequestRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM presentation_requests
      WHERE issuer_id = $1 AND request_exn_said = $2
      LIMIT 1
    `,
    [issuerId, String(requestExnSaid || "").trim()]
  );
  return rows[0] ? mapPresentationRequestRow(rows[0]) : null;
}

export async function getPresentationRequestByAgreeExnSaidForIssuer(
  issuerId: string,
  agreeExnSaid: string
): Promise<PresentationRequestRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM presentation_requests
      WHERE issuer_id = $1 AND agree_exn_said = $2
      LIMIT 1
    `,
    [issuerId, String(agreeExnSaid || "").trim()]
  );
  return rows[0] ? mapPresentationRequestRow(rows[0]) : null;
}

export async function createPresentationRequestForIssuer(input: {
  id?: string;
  issuerId: string;
  requestExnSaid: string;
  verifierDid: string;
  holderDid: string;
  schemaId: string;
  requestedAttributes?: Record<string, string>;
}): Promise<PresentationRequestRecord> {
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO presentation_requests(
        id,
        issuer_id,
        request_exn_said,
        verifier_did,
        holder_did,
        schema_id,
        requested_attributes,
        status,
        requested_at,
        created_at,
        updated_at
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, 'requested', NOW(), NOW(), NOW())
      ON CONFLICT(request_exn_said)
      DO UPDATE SET
        verifier_did = EXCLUDED.verifier_did,
        holder_did = EXCLUDED.holder_did,
        schema_id = EXCLUDED.schema_id,
        requested_attributes = EXCLUDED.requested_attributes,
        updated_at = NOW()
      RETURNING *
    `,
    [
      input.id || randomUUID(),
      input.issuerId,
      String(input.requestExnSaid || "").trim(),
      String(input.verifierDid || "").trim(),
      String(input.holderDid || "").trim(),
      canonicalSchemaId(String(input.schemaId || "").trim()),
      JSON.stringify(input.requestedAttributes || {}),
    ]
  );
  return mapPresentationRequestRow(rows[0]);
}

export async function updatePresentationRequestForIssuer(input: {
  issuerId: string;
  requestId: string;
  status?: PresentationRequestRecord["status"];
  offerExnSaid?: string | null;
  agreeExnSaid?: string | null;
  grantExnSaid?: string | null;
  presentedCredentialId?: string | null;
  presentedIssuerDid?: string | null;
  presentedHolderDid?: string | null;
  presentedAttributes?: Record<string, unknown>;
  verificationChecks?: Record<string, boolean>;
  failureReason?: string | null;
  presentedAt?: string | null;
  verifiedAt?: string | null;
  completedAt?: string | null;
}): Promise<PresentationRequestRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      UPDATE presentation_requests
      SET
        status = COALESCE($3, status),
        offer_exn_said = COALESCE($4, offer_exn_said),
        agree_exn_said = COALESCE($5, agree_exn_said),
        grant_exn_said = COALESCE($6, grant_exn_said),
        presented_credential_id = COALESCE($7, presented_credential_id),
        presented_issuer_did = COALESCE($8, presented_issuer_did),
        presented_holder_did = COALESCE($9, presented_holder_did),
        presented_attributes = COALESCE($10, presented_attributes),
        verification_checks = COALESCE($11, verification_checks),
        failure_reason = COALESCE($12, failure_reason),
        presented_at = COALESCE($13, presented_at),
        verified_at = COALESCE($14, verified_at),
        completed_at = COALESCE($15, completed_at),
        updated_at = NOW()
      WHERE issuer_id = $1 AND id = $2
      RETURNING *
    `,
    [
      input.issuerId,
      input.requestId,
      input.status || null,
      input.offerExnSaid === undefined ? null : input.offerExnSaid,
      input.agreeExnSaid === undefined ? null : input.agreeExnSaid,
      input.grantExnSaid === undefined ? null : input.grantExnSaid,
      input.presentedCredentialId === undefined
        ? null
        : input.presentedCredentialId,
      input.presentedIssuerDid === undefined ? null : input.presentedIssuerDid,
      input.presentedHolderDid === undefined ? null : input.presentedHolderDid,
      input.presentedAttributes === undefined
        ? null
        : JSON.stringify(input.presentedAttributes),
      input.verificationChecks === undefined
        ? null
        : JSON.stringify(input.verificationChecks),
      input.failureReason === undefined ? null : input.failureReason,
      input.presentedAt === undefined ? null : input.presentedAt,
      input.verifiedAt === undefined ? null : input.verifiedAt,
      input.completedAt === undefined ? null : input.completedAt,
    ]
  );
  return rows[0] ? mapPresentationRequestRow(rows[0]) : null;
}

export async function getFaydaVerificationByHolderAidForIssuer(
  issuerId: string,
  holderAid: string
): Promise<IssuerFaydaVerificationRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `
      SELECT *
      FROM issuer_fayda_verifications
      WHERE issuer_id = $1 AND holder_aid = $2
      LIMIT 1
    `,
    [issuerId, String(holderAid || "").trim()]
  );

  return rows[0] ? mapFaydaVerificationRow(rows[0]) : null;
}

export async function upsertFaydaVerificationForIssuer(input: {
  id?: string;
  issuerId: string;
  holderAid: string;
  faydaId: string;
  templateId?: string | null;
  credentialId?: string | null;
  status: IssuerFaydaVerificationRecord["status"];
  missingFields?: string[];
  mappedData?: Record<string, unknown>;
  faydaData?: Record<string, unknown>;
  verifiedAt?: string;
}): Promise<IssuerFaydaVerificationRecord> {
  const rows = await query<Record<string, unknown>>(
    `
      INSERT INTO issuer_fayda_verifications(
        id,
        issuer_id,
        holder_aid,
        fayda_id,
        template_id,
        credential_id,
        status,
        missing_fields,
        mapped_data,
        fayda_data,
        verified_at,
        created_at,
        updated_at
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT(issuer_id, holder_aid)
      DO UPDATE SET
        fayda_id = EXCLUDED.fayda_id,
        template_id = EXCLUDED.template_id,
        credential_id = EXCLUDED.credential_id,
        status = EXCLUDED.status,
        missing_fields = EXCLUDED.missing_fields,
        mapped_data = EXCLUDED.mapped_data,
        fayda_data = EXCLUDED.fayda_data,
        verified_at = EXCLUDED.verified_at,
        updated_at = NOW()
      RETURNING *
    `,
    [
      input.id || randomUUID(),
      input.issuerId,
      String(input.holderAid || "").trim(),
      String(input.faydaId || "").trim(),
      input.templateId || null,
      input.credentialId || null,
      input.status,
      JSON.stringify(input.missingFields || []),
      JSON.stringify(input.mappedData || {}),
      JSON.stringify(input.faydaData || {}),
      input.verifiedAt || new Date().toISOString(),
    ]
  );

  return mapFaydaVerificationRow(rows[0]);
}

export async function deleteFaydaVerificationByHolderAidForIssuer(
  issuerId: string,
  holderAid: string
): Promise<boolean> {
  const rows = await query<Record<string, unknown>>(
    `
      DELETE FROM issuer_fayda_verifications
      WHERE issuer_id = $1 AND holder_aid = $2
      RETURNING id
    `,
    [issuerId, String(holderAid || "").trim()]
  );

  return Boolean(rows.length);
}
