import { Request, Response } from "express";
import { SignifyClient } from "signify-ts";
import {
  CREDENTIAL_NOT_FOUND,
  CREDENTIAL_REVOKED_ALREADY,
  getCredentialEntries,
  getCredentialId,
  issueCredentialAndGrant,
  UNKNOW_SCHEMA_ID,
  revokeCredentialWithNotification,
} from "./credential.api";
import {
  ensureGeneratedSchemaForTemplate,
  findTemplateBySchemaId,
  getIssuedCredentialRecordById,
  isSchemaIdKnown,
  getTemplateById,
  listTemplates,
  markIssuedCredentialStatus,
  upsertIssuedCredentialRecord,
} from "../services/dashboardStore";
import {
  IssuedCredentialRecord,
  TemplateRecord,
} from "../services/dashboardStore.types";
import { sendError, sendSuccess } from "../utils/apiResponse";
import {
  getIssuerAliasFromRequest,
  getQviCredentialIdFromRequest,
  getSignifyClientFromRequest,
} from "../utils/requestContext";

interface CredentialIssueRequestBody {
  templateId?: string;
  connectionId?: string;
  values?: Record<string, unknown>;
}

interface RevokeCredentialBody {
  holder?: string;
}

type SignifyCredentialRecord = {
  id?: string;
  sad?: {
    d?: string;
    s?: string;
    a?: Record<string, unknown>;
  };
  status?: {
    s?: string;
    dt?: string;
  };
};

function toCredentialStatus(statusCode: unknown): IssuedCredentialRecord["status"] {
  return String(statusCode || "") === "1" ? "revoked" : "issued";
}

function toNumberBooleanOrString(
  value: unknown,
  type: string
): string | number | boolean {
  if (type === "integer") {
    return Number.parseInt(String(value), 10);
  }

  if (type === "number") {
    return Number(String(value));
  }

  if (type === "boolean") {
    const normalized = String(value).trim().toLowerCase();
    return ["true", "1", "yes"].includes(normalized);
  }

  return String(value);
}

function buildMappedCredential(
  credential: SignifyCredentialRecord,
  template: TemplateRecord | null,
  existingRecord: IssuedCredentialRecord | null
) {
  const credentialId = getCredentialId(credential);
  const schemaId = String(credential.sad?.s || "");
  const holderDid = String(credential.sad?.a?.i || "");
  const status = toCredentialStatus(credential.status?.s);
  const issuedAt = String(credential.status?.dt || new Date().toISOString());
  const templateId = existingRecord?.templateId || template?.id || "";

  return {
    id: credentialId,
    templateId,
    templateName: template?.name || "",
    schemaId,
    holderDid,
    status,
    data: credential.sad?.a || {},
    issuedAt,
  };
}

async function syncCredentialRecordFromCloud(
  credential: SignifyCredentialRecord
): Promise<IssuedCredentialRecord | null> {
  const credentialId = getCredentialId(credential);
  if (!credentialId) {
    return null;
  }

  const schemaId = String(credential.sad?.s || "");
  const templateBySchema = schemaId ? await findTemplateBySchemaId(schemaId) : null;
  const existingRecord = await getIssuedCredentialRecordById(credentialId);
  const mapped = buildMappedCredential(credential, templateBySchema, existingRecord);

  const record: IssuedCredentialRecord = {
    id: mapped.id,
    templateId: mapped.templateId,
    schemaId: mapped.schemaId,
    holderDid: mapped.holderDid,
    status: mapped.status,
    data: mapped.data,
    issuedAt: mapped.issuedAt,
    createdAt: existingRecord?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revokedAt:
      mapped.status === "revoked"
        ? existingRecord?.revokedAt || new Date().toISOString()
        : existingRecord?.revokedAt,
    deletedAt: existingRecord?.deletedAt,
  };

  await upsertIssuedCredentialRecord(record);
  return record;
}

async function getIssuerCredentials(
  client: SignifyClient,
  issuerAlias: string
): Promise<SignifyCredentialRecord[]> {
  const issuer = await client.identifiers().get(issuerAlias);
  const listResult = await client.credentials().list({
    filter: {
      "-i": issuer.prefix,
    },
  });

  return getCredentialEntries(listResult) as SignifyCredentialRecord[];
}

export async function listCredentialsApi(_: Request, res: Response): Promise<void> {
  // OpenAPI: GET /api/credentials
  const client = getSignifyClientFromRequest(res);
  const issuerAlias = getIssuerAliasFromRequest(res);
  const templates = await listTemplates();
  const templateMap = new Map(templates.map((template) => [template.id, template]));

  const cloudCredentials = await getIssuerCredentials(client, issuerAlias);
  const syncedRecords = (
    await Promise.all(cloudCredentials.map((credential) => syncCredentialRecordFromCloud(credential)))
  ).filter((item): item is IssuedCredentialRecord => item !== null);

  const payload = syncedRecords.map((record) => ({
    ...record,
    templateName: templateMap.get(record.templateId)?.name || "",
  }));

  sendSuccess(res, payload);
}

export async function getCredentialByIdApi(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  // OpenAPI: GET /api/credentials/:id
  const client = getSignifyClientFromRequest(req);
  const credentialId = String(req.params.id || "").trim();
  if (!credentialId) {
    sendError(res, 400, "Credential id is required");
    return;
  }

  const credential = await client
    .credentials()
    .get(credentialId)
    .catch(() => null);

  if (!credential) {
    const existingRecord = await getIssuedCredentialRecordById(credentialId);
    if (!existingRecord) {
      sendError(res, 404, "Credential not found");
      return;
    }

    const template = await getTemplateById(existingRecord.templateId);
    sendSuccess(res, {
      ...existingRecord,
      templateName: template?.name || "",
    });
    return;
  }

  const syncedRecord = await syncCredentialRecordFromCloud(
    credential as SignifyCredentialRecord
  );
  if (!syncedRecord) {
    sendError(res, 404, "Credential not found");
    return;
  }

  const template = await getTemplateById(syncedRecord.templateId);
  sendSuccess(res, {
    ...syncedRecord,
    templateName: template?.name || "",
  });
}

export async function issueCredentialApi(
  req: Request<{}, {}, CredentialIssueRequestBody>,
  res: Response
): Promise<void> {
  // OpenAPI: POST /api/credentials/issue
  const client = getSignifyClientFromRequest(req);
  const qviCredentialId = getQviCredentialIdFromRequest(req);
  const issuerAlias = getIssuerAliasFromRequest(req);

  const templateId = String(req.body.templateId || "").trim();
  const connectionId = String(req.body.connectionId || "").trim();
  const values = req.body.values || {};

  if (!templateId) {
    sendError(res, 400, "templateId is required");
    return;
  }

  if (!connectionId) {
    sendError(res, 400, "connectionId is required");
    return;
  }

  const template = await getTemplateById(templateId);
  if (!template) {
    sendError(res, 404, "Template not found");
    return;
  }

  if (!isSchemaIdKnown(template.schemaId)) {
    await ensureGeneratedSchemaForTemplate({
      schemaId: template.schemaId,
      name: template.name,
      attributes: template.attributes,
    });
  }

  if (!isSchemaIdKnown(template.schemaId)) {
    sendError(res, 400, `Template schemaId is unsupported: ${template.schemaId}`);
    return;
  }

  const attributePayload: Record<string, unknown> = {};
  for (const attribute of template.attributes) {
    const rawValue = values[attribute.name];

    if (
      attribute.required &&
      (rawValue === undefined ||
        rawValue === null ||
        String(rawValue).trim() === "")
    ) {
      sendError(res, 400, `Missing required attribute: ${attribute.name}`);
      return;
    }

    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
      continue;
    }

    attributePayload[attribute.name] = toNumberBooleanOrString(
      rawValue,
      attribute.type
    );
  }

  try {
    const credentialId = await issueCredentialAndGrant(client, qviCredentialId, {
      schemaSaid: template.schemaId,
      aid: connectionId,
      attribute: attributePayload,
    }, {
      issuerName: issuerAlias,
    });

    const now = new Date().toISOString();
    const record: IssuedCredentialRecord = {
      id: credentialId,
      templateId: template.id,
      schemaId: template.schemaId,
      holderDid: connectionId,
      status: "issued",
      data: attributePayload,
      issuedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await upsertIssuedCredentialRecord(record);
    sendSuccess(
      res,
      {
        ...record,
        templateName: template.name,
      },
      201
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to issue credential";
    if (message.startsWith(UNKNOW_SCHEMA_ID)) {
      sendError(res, 400, message);
      return;
    }

    sendError(
      res,
      500,
      message
    );
  }
}

export async function revokeCredentialByIdApi(
  req: Request<{ id: string }, {}, RevokeCredentialBody>,
  res: Response
): Promise<void> {
  // OpenAPI: PUT /api/credentials/:id/revoke
  const client = getSignifyClientFromRequest(req);
  const issuerAlias = getIssuerAliasFromRequest(req);
  const credentialId = String(req.params.id || "").trim();

  if (!credentialId) {
    sendError(res, 400, "Credential id is required");
    return;
  }

  const record = await getIssuedCredentialRecordById(credentialId);
  const holderFromBody = String(req.body?.holder || "").trim();
  const holderDid = holderFromBody || record?.holderDid || undefined;

  try {
    const { alreadyRevoked } = await revokeCredentialWithNotification(
      client,
      credentialId,
      holderDid,
      {
        issuerName: issuerAlias,
      }
    );

    if (alreadyRevoked) {
      await markIssuedCredentialStatus(credentialId, "revoked");
      sendError(res, 409, CREDENTIAL_REVOKED_ALREADY);
      return;
    }

    const updatedRecord = await markIssuedCredentialStatus(credentialId, "revoked");
    sendSuccess(res, {
      id: credentialId,
      status: "revoked",
      record: updatedRecord,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith(CREDENTIAL_NOT_FOUND)) {
      sendError(res, 404, message);
      return;
    }

    sendError(res, 500, message || "Unable to revoke credential");
  }
}

export async function deleteCredentialByIdApi(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  // OpenAPI: DELETE /api/credentials/:id
  const client = getSignifyClientFromRequest(req);
  const issuerAlias = getIssuerAliasFromRequest(req);
  const credentialId = String(req.params.id || "").trim();
  if (!credentialId) {
    sendError(res, 400, "Credential id is required");
    return;
  }

  let credential = await client
    .credentials()
    .get(credentialId)
    .catch(() => null);

  if (!credential) {
    await markIssuedCredentialStatus(credentialId, "deleted");
    sendSuccess(res, {
      id: credentialId,
      status: "deleted",
      message: "Credential already removed from cloud storage",
    });
    return;
  }

  if (String(credential.status?.s || "") !== "1") {
    const existingRecord = await getIssuedCredentialRecordById(credentialId);
    const holderDid =
      String(existingRecord?.holderDid || credential.sad?.a?.i || "").trim() ||
      undefined;

    try {
      await revokeCredentialWithNotification(client, credentialId, holderDid, {
        issuerName: issuerAlias,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith(CREDENTIAL_NOT_FOUND)) {
        await markIssuedCredentialStatus(credentialId, "deleted");
        sendSuccess(res, {
          id: credentialId,
          status: "deleted",
          message: "Credential already removed from cloud storage",
        });
        return;
      }

      sendError(res, 500, message || "Unable to revoke credential before deletion");
      return;
    }

    credential = await client
      .credentials()
      .get(credentialId)
      .catch(() => null);

    if (!credential) {
      await markIssuedCredentialStatus(credentialId, "deleted");
      sendSuccess(res, {
        id: credentialId,
        status: "deleted",
        message: "Credential already removed from cloud storage",
      });
      return;
    }
  }

  await client.credentials().delete(credentialId);
  const updatedRecord = await markIssuedCredentialStatus(credentialId, "deleted");

  sendSuccess(res, {
    id: credentialId,
    status: "deleted",
    record: updatedRecord,
  });
}
