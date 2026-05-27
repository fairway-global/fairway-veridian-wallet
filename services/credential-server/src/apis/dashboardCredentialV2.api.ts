import { Request, Response } from "express";
import { SignifyClient } from "signify-ts";
import {
  CREDENTIAL_NOT_FOUND,
  CREDENTIAL_REVOKED_ALREADY,
  getCredentialEntries,
  getCredentialId,
  issueCredentialAndGrant,
  revokeCredentialWithNotification,
  UNKNOW_SCHEMA_ID,
} from "./credential.api";
import {
  ensureGeneratedSchemaForTemplate,
  isSchemaIdKnown,
} from "../services/dashboardStore";
import { getFaydaPrefillForTemplateAttributes } from "../services/faydaPrefillService";
import {
  findTemplateBySchemaIdForIssuer,
  getFaydaVerificationByHolderAidForIssuer,
  getIssuedCredentialByIdForIssuer,
  getTemplateByIdForIssuer,
  listIssuedCredentialsByIssuer,
  listTemplatesByIssuer,
  markIssuedCredentialStatusForIssuer,
  upsertIssuedCredentialForIssuer,
} from "../services/tenantStore";
import { RealtimeEventService } from "../services/realtimeEventService";
import { sendError, sendSuccess } from "../utils/apiResponse";
import { getIssuerAliasFromRequest, getQviCredentialIdFromRequest } from "../utils/requestContext";
import { coerceTemplateAttributeValue } from "../services/templateAttributeUtils";

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

function toCredentialStatus(statusCode: unknown): "issued" | "revoked" {
  return String(statusCode || "") === "1" ? "revoked" : "issued";
}

function getIssuerId(req: Request): string {
  return String(req.authUser?.issuerId || "").trim();
}

function getRealtimeEventService(req: Request): RealtimeEventService | null {
  return req.app.get("realtimeEventService") as RealtimeEventService | null;
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

async function syncCredentialRecordFromCloud(
  issuerId: string,
  credential: SignifyCredentialRecord
) {
  const credentialId = getCredentialId(credential);
  if (!credentialId) {
    return null;
  }
  const schemaId = String(credential.sad?.s || "");
  const templateBySchema = schemaId
    ? await findTemplateBySchemaIdForIssuer(issuerId, schemaId)
    : null;
  const existingRecord = await getIssuedCredentialByIdForIssuer(
    issuerId,
    credentialId
  );
  const status = toCredentialStatus(credential.status?.s);
  const issuedAt = String(credential.status?.dt || new Date().toISOString());
  const record = await upsertIssuedCredentialForIssuer({
    id: credentialId,
    issuerId,
    templateId: existingRecord?.templateId || templateBySchema?.id || "",
    schemaId: schemaId,
    holderDid: String(credential.sad?.a?.i || ""),
    status,
    data: credential.sad?.a || {},
    issuedAt,
    revokedAt:
      status === "revoked"
        ? existingRecord?.revokedAt || new Date().toISOString()
        : existingRecord?.revokedAt,
    deletedAt: existingRecord?.deletedAt,
  });

  return {
    ...record,
    templateName: templateBySchema?.name || "",
  };
}

export async function listCredentialsApiV2(
  req: Request,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const client: SignifyClient = req.issuerRuntime?.client || req.app.get("signifyClient");
  const issuerAlias = getIssuerAliasFromRequest(req);
  const templates = await listTemplatesByIssuer(issuerId);
  const templateMap = new Map(templates.map((template) => [template.id, template]));

  const cloudCredentials = await getIssuerCredentials(client, issuerAlias);
  const syncedRecords = (
    await Promise.all(
      cloudCredentials.map((credential) =>
        syncCredentialRecordFromCloud(issuerId, credential)
      )
    )
  ).filter((item) => item !== null);

  const payload = syncedRecords.map((record) => ({
    ...record,
    templateName: templateMap.get(record!.templateId)?.name || record!.templateName,
  }));
  sendSuccess(res, payload);
}

export async function getCredentialByIdApiV2(
  req: Request<{ id: string }>
,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const client: SignifyClient = req.issuerRuntime?.client || req.app.get("signifyClient");
  const credentialId = String(req.params.id || "").trim();
  if (!credentialId) {
    sendError(res, 400, "Credential id is required");
    return;
  }

  const credential = await client.credentials().get(credentialId).catch(() => null);
  if (!credential) {
    const existingRecord = await getIssuedCredentialByIdForIssuer(
      issuerId,
      credentialId
    );
    if (!existingRecord) {
      sendError(res, 404, "Credential not found");
      return;
    }

    const template = await getTemplateByIdForIssuer(
      issuerId,
      existingRecord.templateId
    );
    sendSuccess(res, {
      ...existingRecord,
      templateName: template?.name || "",
    });
    return;
  }

  const synced = await syncCredentialRecordFromCloud(
    issuerId,
    credential as SignifyCredentialRecord
  );
  if (!synced) {
    sendError(res, 404, "Credential not found");
    return;
  }
  sendSuccess(res, synced);
}

export async function issueCredentialApiV2(
  req: Request<{}, {}, CredentialIssueRequestBody>,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const client: SignifyClient = req.issuerRuntime?.client || req.app.get("signifyClient");
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

  const template = await getTemplateByIdForIssuer(issuerId, templateId);
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

    const typedValue = coerceTemplateAttributeValue(rawValue, attribute);
    if (typedValue === undefined) {
      sendError(res, 400, `Invalid value for attribute: ${attribute.name}`);
      return;
    }

    attributePayload[attribute.name] = typedValue;
  }

  try {
    const credentialId = await issueCredentialAndGrant(
      client,
      qviCredentialId,
      {
        schemaSaid: template.schemaId,
        aid: connectionId,
        attribute: attributePayload,
      },
      {
        issuerName: issuerAlias,
      }
    );
    const now = new Date().toISOString();
    const record = await upsertIssuedCredentialForIssuer({
      id: credentialId,
      issuerId,
      templateId: template.id,
      schemaId: template.schemaId,
      holderDid: connectionId,
      status: "issued",
      data: attributePayload,
      issuedAt: now,
    });
    const realtimeService = getRealtimeEventService(req);
    if (realtimeService) {
      realtimeService.publishToIssuer(issuerId, {
        type: "credentials.refresh",
        payload: {
          credentialId,
          action: "issued",
          holderDid: connectionId,
        },
        notification: {
          title: "Credential issued",
          message: `${template.name} was issued to ${connectionId}.`,
          level: "success",
        },
      });
    }
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
    sendError(res, 500, message);
  }
}

export async function getIssueCredentialPrefillApiV2(
  req: Request,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const templateId = String(req.query.templateId || "").trim();
  const connectionId = String(req.query.connectionId || "").trim();

  if (!templateId) {
    sendError(res, 400, "templateId is required");
    return;
  }
  if (!connectionId) {
    sendError(res, 400, "connectionId is required");
    return;
  }

  const template = await getTemplateByIdForIssuer(issuerId, templateId);
  if (!template) {
    sendError(res, 404, "Template not found");
    return;
  }

  const verification = await getFaydaVerificationByHolderAidForIssuer(
    issuerId,
    connectionId
  );

  if (!verification) {
    sendSuccess(res, {
      hasSavedFaydaData: false,
      matchedFields: [],
      values: {},
    });
    return;
  }

  const prefill = getFaydaPrefillForTemplateAttributes({
    attributes: template.attributes,
    mappedData: verification.mappedData,
    faydaData: verification.faydaData,
  });

  sendSuccess(res, {
    hasSavedFaydaData: true,
    matchedFields: prefill.matchedFields,
    values: prefill.values,
  });
}

export async function revokeCredentialByIdApiV2(
  req: Request<{ id: string }, {}, RevokeCredentialBody>,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const client: SignifyClient = req.issuerRuntime?.client || req.app.get("signifyClient");
  const issuerAlias = getIssuerAliasFromRequest(req);
  const credentialId = String(req.params.id || "").trim();
  if (!credentialId) {
    sendError(res, 400, "Credential id is required");
    return;
  }

  const holder = String(req.body.holder || "").trim();

  try {
    const { alreadyRevoked } = await revokeCredentialWithNotification(
      client,
      credentialId,
      holder,
      {
        issuerName: issuerAlias,
      }
    );
    if (alreadyRevoked) {
      sendError(res, 409, CREDENTIAL_REVOKED_ALREADY);
      return;
    }

    const updated = await markIssuedCredentialStatusForIssuer(
      issuerId,
      credentialId,
      "revoked"
    );
    const realtimeService = getRealtimeEventService(req);
    if (realtimeService) {
      realtimeService.publishToIssuer(issuerId, {
        type: "credentials.refresh",
        payload: {
          credentialId,
          action: "revoked",
        },
        notification: {
          title: "Credential revoked",
          message: `Credential ${credentialId} was revoked.`,
          level: "warning",
        },
      });
    }
    sendSuccess(res, {
      id: credentialId,
      status: updated?.status || "revoked",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith(CREDENTIAL_NOT_FOUND)) {
      sendError(res, 404, message);
      return;
    }
    sendError(res, 500, message);
  }
}

export async function deleteCredentialByIdApiV2(
  req: Request<{ id: string }>
,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const client: SignifyClient = req.issuerRuntime?.client || req.app.get("signifyClient");
  const credentialId = String(req.params.id || "").trim();
  if (!credentialId) {
    sendError(res, 400, "Credential id is required");
    return;
  }

  const existing = await getIssuedCredentialByIdForIssuer(issuerId, credentialId);
  if (!existing) {
    sendError(res, 404, "Credential not found");
    return;
  }
  if (existing.status !== "revoked") {
    sendError(
      res,
      409,
      "Credential must be revoked before delete",
      { id: credentialId, status: existing.status }
    );
    return;
  }

  await client.credentials().delete(credentialId).catch((error) => {
    const message = String((error as Error)?.message || "");
    if (!/404/gi.test(message)) {
      throw error;
    }
  });
  const updated = await markIssuedCredentialStatusForIssuer(
    issuerId,
    credentialId,
    "deleted"
  );
  const realtimeService = getRealtimeEventService(req);
  if (realtimeService) {
    realtimeService.publishToIssuer(issuerId, {
      type: "credentials.refresh",
      payload: {
        credentialId,
        action: "deleted",
      },
      notification: {
        title: "Credential deleted",
        message: `Credential ${credentialId} was deleted.`,
        level: "error",
      },
    });
  }
  sendSuccess(res, {
    id: credentialId,
    status: updated?.status || "deleted",
  });
}

export async function listIssuedCredentialsForTemplateApiV2(
  req: Request,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const templateId = String(req.params.id || "").trim();
  const records = (await listIssuedCredentialsByIssuer(issuerId)).filter(
    (item) => item.templateId === templateId
  );
  sendSuccess(res, records);
}
