import { NextFunction, Request, Response } from "express";
import { Serder, SignifyClient } from "signify-ts";
import {
  canonicalSchemaId,
  FAYDA_AUTO_VERIFIED_SCHEMA_SAID,
  FAYDA_FAIRWAY_ID_SCHEMA_SAID,
} from "../consts";
import { issueCredentialAndGrant, UNKNOW_SCHEMA_ID } from "./credential.api";
import { OP_TIMEOUT, waitAndGetDoneOp } from "../utils/utils";
import {
  getIssuerAliasFromRequest,
  getQviCredentialIdFromRequest,
  getSignifyClientFromRequest,
} from "../utils/requestContext";
import { config } from "../config";
import {
  getAutoIssueTemplateByIssuer,
  getIssuerByAidPrefix,
  getIssuerByCode,
} from "../services/tenantStore";
import { IssuerTemplateRecord } from "../services/tenantStore.types";
import { RealtimeEventService } from "../services/realtimeEventService";
import { IssuerSignifyService } from "../services/issuerSignifyService";

type FaydaData = {
  id?: string;
  fayda_id?: string;
  sub?: string;
  faydaId?: string;
  national_id?: string;
  additionalProp1?: unknown;
  name?: string;
  email?: string;
  phone_number?: string;
  birthdate?: string;
  gender?: string;
  [key: string]: unknown;
};

type SaveFaydaDataRequest = {
  aid?: string;
  connectionId?: string;
  schemaSaid?: string;
  credentialName?: string;
  issuerAid?: string;
  issuerCode?: string;
  faydaData?: FaydaData;
};

type GenericCredential = {
  id?: string;
  status?: {
    s?: string;
  };
  sad?: {
    d?: string;
    s?: string;
    i?: string;
    a?: Record<string, unknown>;
  };
  acdc?: {
    sad?: {
      d?: string;
      s?: string;
      i?: string;
      a?: Record<string, unknown>;
    };
  };
  atc?: unknown;
  ancatc?: unknown;
  issAtc?: unknown;
  issatc?: unknown;
  acdcAttachment?: unknown;
  ancAttachment?: unknown;
  issAttachment?: unknown;
  [key: string]: unknown;
};

const REQUIRED_FAYDA_FIELDS = [
  "name",
  "email",
  "phone_number",
  "birthdate",
  "gender",
] as const;
const FAYDA_ID_KEYS = [
  "fayda_id",
  "id",
  "sub",
  "faydaId",
  "national_id",
] as const;
const DEFAULT_FAYDA_SCHEMA_SAID = FAYDA_AUTO_VERIFIED_SCHEMA_SAID;
const STATUS_DEFAULT_SCHEMA_SAIDS = [
  FAYDA_AUTO_VERIFIED_SCHEMA_SAID,
  FAYDA_FAIRWAY_ID_SCHEMA_SAID,
];

type ResolvedFaydaRequestContext = {
  issuerId: string;
  client: SignifyClient;
  issuerAlias: string;
  qviCredentialId: string;
};

function toTrimmedString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function isBase64DataUri(value: unknown): boolean {
  return typeof value === "string" && /^data:[^;]+;base64,/i.test(value);
}

function extractFaydaIdFromRecord(record: Record<string, unknown>): string {
  for (const key of FAYDA_ID_KEYS) {
    const value = toTrimmedString(record[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function extractFaydaId(faydaData: FaydaData): string {
  const direct = extractFaydaIdFromRecord(faydaData as Record<string, unknown>);
  if (direct) {
    return direct;
  }

  if (
    faydaData.additionalProp1 &&
    typeof faydaData.additionalProp1 === "object" &&
    !Array.isArray(faydaData.additionalProp1)
  ) {
    return extractFaydaIdFromRecord(
      faydaData.additionalProp1 as Record<string, unknown>
    );
  }

  return "";
}

function buildAttribute(faydaData: FaydaData): Record<string, unknown> {
  const issuedAt = new Date().toISOString();
  const faydaId = extractFaydaId(faydaData);

  if (!faydaId) {
    throw new Error(
      "Missing required Fayda identifier. Provide faydaData.id, faydaData.fayda_id, or faydaData.sub."
    );
  }

  const normalized = {
    name: toTrimmedString(faydaData.name),
    email: toTrimmedString(faydaData.email),
    phone_number: toTrimmedString(faydaData.phone_number),
    birthdate: toTrimmedString(faydaData.birthdate),
    gender: toTrimmedString(faydaData.gender),
  };

  const missingFields = REQUIRED_FAYDA_FIELDS.filter(
    (field) => !normalized[field]
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required Fayda fields: ${missingFields.join(", ")}`
    );
  }

  const extraFields = Object.fromEntries(
    Object.entries(faydaData).filter(([key, value]) => {
      return (
        !REQUIRED_FAYDA_FIELDS.includes(
          key as (typeof REQUIRED_FAYDA_FIELDS)[number]
        ) &&
        !FAYDA_ID_KEYS.includes(key as (typeof FAYDA_ID_KEYS)[number]) &&
        key !== "picture" &&
        key !== "additionalProp1" &&
        !isBase64DataUri(value) &&
        value !== undefined &&
        value !== null
      );
    })
  );

  return {
    dt: issuedAt,
    fayda_id: faydaId,
    ...normalized,
    ...extraFields,
  };
}

function getCredentialEntries(listResponse: unknown): GenericCredential[] {
  if (Array.isArray(listResponse)) {
    return listResponse as GenericCredential[];
  }
  if (!listResponse || typeof listResponse !== "object") {
    return [];
  }

  const data = listResponse as Record<string, unknown>;
  const candidates = [data.credentials, data.items, data.data];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as GenericCredential[];
    }
  }

  return [];
}

function getCredentialSad(credential: GenericCredential): Record<string, unknown> {
  return credential.sad || credential.acdc?.sad || credential.acdc || {};
}

function getCredentialId(credential: GenericCredential): string {
  const sad = getCredentialSad(credential);
  return toTrimmedString(sad?.d || credential.id);
}

function getCredentialHolderAid(credential: GenericCredential): string {
  const sad = getCredentialSad(credential);
  const attributes = (sad?.a || {}) as Record<string, unknown>;
  return toTrimmedString(attributes.i);
}

function getCredentialSchemaSaid(credential: GenericCredential): string {
  const sad = getCredentialSad(credential);
  return toTrimmedString(sad?.s);
}

function getCredentialFaydaId(credential: GenericCredential): string {
  const sad = getCredentialSad(credential);
  const attributes = (sad?.a || {}) as Record<string, unknown>;

  const direct = extractFaydaIdFromRecord(attributes);
  if (direct) {
    return direct;
  }

  const nested = attributes.additionalProp1;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return extractFaydaIdFromRecord(nested as Record<string, unknown>);
  }

  return "";
}

function isCredentialRevoked(credential: GenericCredential): boolean {
  return toTrimmedString(credential.status?.s) === "1";
}

function toAttachment(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item);
    return typeof first === "string" ? first : undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return undefined;
}

function buildGrantAttachments(credential: GenericCredential): {
  acdcAttachment?: string;
  ancAttachment?: string;
  issAttachment?: string;
} {
  return {
    acdcAttachment: toAttachment(credential.atc ?? credential.acdcAttachment),
    ancAttachment: toAttachment(
      credential.ancatc ?? credential.ancAttachment
    ),
    issAttachment: toAttachment(
      credential.issAtc ?? credential.issatc ?? credential.issAttachment
    ),
  };
}

function getSchemaSaid(
  payloadSchemaSaid: string | undefined,
  fallbackSchema: string
): string {
  return canonicalSchemaId(
    String(
      payloadSchemaSaid || process.env.FAYDA_SCHEMA_SAID || fallbackSchema
    ).trim()
  );
}

function getRealtimeEventService(req: Request): RealtimeEventService | null {
  return req.app.get("realtimeEventService") as RealtimeEventService | null;
}

async function resolveFaydaRequestContext(
  req: Request,
  issuerId: string
): Promise<ResolvedFaydaRequestContext> {
  const normalizedIssuerId = toTrimmedString(issuerId);
  if (normalizedIssuerId && req.issuerRuntime?.issuerId === normalizedIssuerId) {
    return {
      issuerId: normalizedIssuerId,
      client: req.issuerRuntime.client,
      issuerAlias: toTrimmedString(req.issuerRuntime.aidAlias),
      qviCredentialId: toTrimmedString(req.issuerRuntime.qviCredentialId),
    };
  }

  if (normalizedIssuerId) {
    const issuerSignifyService = req.app.get(
      "issuerSignifyService"
    ) as IssuerSignifyService | null;

    if (issuerSignifyService) {
      const runtime = await issuerSignifyService.getRuntimeByIssuerId(
        normalizedIssuerId
      );
      return {
        issuerId: normalizedIssuerId,
        client: runtime.client,
        issuerAlias: toTrimmedString(runtime.aidAlias),
        qviCredentialId: toTrimmedString(runtime.qviCredentialId),
      };
    }
  }

  return {
    issuerId: normalizedIssuerId,
    client: getSignifyClientFromRequest(req),
    issuerAlias: getIssuerAliasFromRequest(req),
    qviCredentialId: getQviCredentialIdFromRequest(req),
  };
}

async function resolveIssuerIdForFaydaRequest(req: Request): Promise<string> {
  const issuerId = toTrimmedString(
    req.authUser?.issuerId || req.issuerRuntime?.issuerId || req.gatewayToken?.issuerId
  );
  if (issuerId) {
    return issuerId;
  }

  const issuerAid = toTrimmedString(
    (req.body as SaveFaydaDataRequest | undefined)?.issuerAid ||
      (req.query.issuerAid as string | undefined)
  );
  if (issuerAid) {
    const issuerByAid = await getIssuerByAidPrefix(issuerAid);
    if (issuerByAid?.id) {
      return toTrimmedString(issuerByAid.id);
    }
  }

  const issuerCode = toTrimmedString(
    (req.body as SaveFaydaDataRequest | undefined)?.issuerCode ||
      (req.query.issuerCode as string | undefined)
  );
  if (issuerCode) {
    const issuerByCode = await getIssuerByCode(issuerCode);
    if (issuerByCode?.id) {
      return toTrimmedString(issuerByCode.id);
    }
  }

  const defaultIssuer = await getIssuerByCode(config.defaultIssuerCode);
  return toTrimmedString(defaultIssuer?.id);
}

async function getAutoIssueTemplateForRequest(
  req: Request,
  issuerId?: string
): Promise<IssuerTemplateRecord | null> {
  const resolvedIssuerId = toTrimmedString(issuerId)
    ? toTrimmedString(issuerId)
    : await resolveIssuerIdForFaydaRequest(req);
  if (!resolvedIssuerId) {
    return null;
  }
  return getAutoIssueTemplateByIssuer(resolvedIssuerId);
}

type FaydaVerificationResult = {
  alreadyIssuedCredentialId?: string;
  conflictingCredentialId?: string;
  conflictingHolderAid?: string;
  conflictMessage?: string;
};

async function verifyFaydaIdentifierForAutoIssue(
  client: SignifyClient,
  issuerAlias: string,
  holderAid: string,
  schemaSaid: string,
  faydaId: string
): Promise<FaydaVerificationResult> {
  const issuer = await client.identifiers().get(issuerAlias);
  const credentialsResponse = await client.credentials().list({
    filter: {
      "-i": issuer.prefix,
      "-s": { $eq: schemaSaid },
    },
  });
  const credentials = getCredentialEntries(credentialsResponse);

  for (const credential of credentials) {
    if (isCredentialRevoked(credential)) {
      continue;
    }

    const credentialHolderAid = getCredentialHolderAid(credential);
    const credentialFaydaId = getCredentialFaydaId(credential);
    const credentialId = getCredentialId(credential);

    if (!credentialId || !credentialFaydaId || !credentialHolderAid) {
      continue;
    }

    if (credentialHolderAid === holderAid && credentialFaydaId === faydaId) {
      return {
        alreadyIssuedCredentialId: credentialId,
      };
    }

    if (credentialHolderAid !== holderAid && credentialFaydaId === faydaId) {
      return {
        conflictingCredentialId: credentialId,
        conflictingHolderAid: credentialHolderAid,
        conflictMessage:
          "Fayda ID is already verified and linked to another holder.",
      };
    }

    if (credentialHolderAid === holderAid && credentialFaydaId !== faydaId) {
      return {
        conflictingCredentialId: credentialId,
        conflictingHolderAid: credentialHolderAid,
        conflictMessage:
          "Holder already has an active Fayda verification credential with a different Fayda ID.",
      };
    }
  }

  return {};
}

export async function getFaydaDataStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const aid = String(req.query.aid || "").trim();
  const requestedSchema = toTrimmedString(req.query.schemaSaid);

  if (!aid) {
    res.status(400).send({
      success: false,
      data: "Missing holder AID. Send 'aid' as query parameter.",
    });
    return;
  }

  try {
    const issuerId = await resolveIssuerIdForFaydaRequest(req);
    const { client, issuerAlias } = await resolveFaydaRequestContext(
      req,
      issuerId
    );
    const autoIssueTemplate = await getAutoIssueTemplateForRequest(req, issuerId);
    const autoIssueConfigured = Boolean(autoIssueTemplate);
    const schemaSaid = requestedSchema
      ? getSchemaSaid(
          requestedSchema,
          autoIssueTemplate?.schemaId || DEFAULT_FAYDA_SCHEMA_SAID
        )
      : autoIssueTemplate
        ? canonicalSchemaId(autoIssueTemplate.schemaId)
        : "";
    const schemaCandidates =
      requestedSchema && schemaSaid
        ? [schemaSaid]
        : autoIssueTemplate
          ? [canonicalSchemaId(autoIssueTemplate.schemaId)]
          : STATUS_DEFAULT_SCHEMA_SAIDS;

    const issuer = await client.identifiers().get(issuerAlias);
    const credentialsResponse = await client.credentials().list({
      filter: {
        "-a-i": aid,
      },
    });
    const credentials = getCredentialEntries(credentialsResponse);

    const verifiedCredential = credentials.find((credential) => {
      const holderAid = getCredentialHolderAid(credential);
      const credentialSchemaSaid = getCredentialSchemaSaid(credential);
      const sad = getCredentialSad(credential);
      const issuerAid = toTrimmedString(sad?.i);

      return (
        holderAid === aid &&
        schemaCandidates.includes(credentialSchemaSaid) &&
        issuerAid === issuer.prefix &&
        !isCredentialRevoked(credential)
      );
    });

    res.status(200).send({
      success: true,
      data: {
        aid,
        schemaSaid: schemaSaid || null,
        verified: Boolean(verifiedCredential),
        verifiedSchemaSaid: verifiedCredential
          ? getCredentialSchemaSaid(verifiedCredential)
          : null,
        autoIssueConfigured,
        autoIssueTemplateId: autoIssueTemplate?.id || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function saveFaydaData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const body = req.body as SaveFaydaDataRequest;
  const aid = String(body.aid || body.connectionId || "").trim();
  const requestedSchema = toTrimmedString(body.schemaSaid);

  if (!aid) {
    res.status(400).send({
      success: false,
      data: "Missing holder AID. Send 'aid' or 'connectionId' in request body.",
    });
    return;
  }

  try {
    const issuerId = await resolveIssuerIdForFaydaRequest(req);
    const { client, qviCredentialId, issuerAlias } =
      await resolveFaydaRequestContext(req, issuerId);
    const autoIssueTemplate = await getAutoIssueTemplateForRequest(req, issuerId);
    const autoIssueConfigured = Boolean(autoIssueTemplate);
    const schemaSaid = requestedSchema
      ? getSchemaSaid(
          requestedSchema,
          autoIssueTemplate?.schemaId || DEFAULT_FAYDA_SCHEMA_SAID
        )
      : autoIssueTemplate
        ? canonicalSchemaId(autoIssueTemplate.schemaId)
        : "";
    const faydaData = body.faydaData || {};
    const credentialName = String(
      body.credentialName || autoIssueTemplate?.name || "FaydaVerifiedAutoIssue"
    ).trim();

    if (!schemaSaid) {
      res.status(200).send({
        success: true,
        data: {
          message:
            "Fayda verification succeeded. No auto-issue template is configured, so no credential was issued.",
          credentialName: null,
          holderAid: aid,
          schemaSaid: null,
          faydaId: extractFaydaId(faydaData) || null,
          credentialId: null,
          alreadyIssued: false,
          autoIssueConfigured,
          autoIssued: false,
          verified: false,
        },
      });
      return;
    }

    const attribute = buildAttribute(faydaData);
    const faydaId = toTrimmedString(attribute.fayda_id);
    const verification = await verifyFaydaIdentifierForAutoIssue(
      client,
      issuerAlias,
      aid,
      schemaSaid,
      faydaId
    );

    if (verification.conflictingCredentialId) {
      res.status(409).send({
        success: false,
        data: {
          message:
            verification.conflictMessage ||
            "Fayda verification conflict detected.",
          faydaId,
          conflictingCredentialId: verification.conflictingCredentialId,
          conflictingHolderAid: verification.conflictingHolderAid || null,
          schemaSaid,
          autoIssueConfigured,
        },
      });
      return;
    }

    if (verification.alreadyIssuedCredentialId) {
      res.status(200).send({
        success: true,
        data: {
          message: "Fayda already verified. Credential is already active.",
          credentialName,
          holderAid: aid,
          schemaSaid,
          faydaId,
          credentialId: verification.alreadyIssuedCredentialId,
          alreadyIssued: true,
          autoIssueConfigured,
          autoIssued: false,
          verified: true,
        },
      });
      return;
    }

    const credentialId = await issueCredentialAndGrant(client, qviCredentialId, {
      schemaSaid,
      aid,
      attribute,
    }, {
      issuerName: issuerAlias,
    });
    const realtimeService = getRealtimeEventService(req);
    if (realtimeService && issuerId) {
      realtimeService.publishToIssuer(issuerId, {
        type: "credentials.refresh",
        payload: {
          credentialId,
          action: "issued_auto_fayda",
          holderDid: aid,
          schemaSaid,
        },
        notification: {
          title: "Credential issued",
          message: `${credentialName} was auto-issued after Fayda verification.`,
          level: "success",
        },
      });
    }

    res.status(200).send({
      success: true,
      data: {
        message:
          "Fayda verification succeeded and credential offer was sent automatically.",
        credentialName,
        holderAid: aid,
        schemaSaid,
        faydaId,
        credentialId,
        alreadyIssued: false,
        autoIssueConfigured,
        autoIssued: true,
        verified: true,
      },
    });
  } catch (error: unknown) {
    const message = String((error as Error)?.message ?? error ?? "");
    const normalized = message.toLowerCase();
    if (
      message.includes("Missing required Fayda fields") ||
      message.includes("Missing required Fayda identifier")
    ) {
      res.status(400).send({
        success: false,
        data: message,
      });
      return;
    }
    if (message.includes(UNKNOW_SCHEMA_ID)) {
      res.status(409).send({
        success: false,
        data: message,
      });
      return;
    }
    if (
      normalized.includes("must be loaded with data oobi before issuing credentials") ||
      (normalized.includes("credential schema") &&
        normalized.includes("not found")) ||
      (normalized.includes("credential schema") &&
        normalized.includes("not loaded"))
    ) {
      res.status(400).send({
        success: false,
        data:
          `${message} ` +
          "Configure OOBI_ENDPOINT to a hostname KERIA can reach (not localhost when KERIA is remote/containerized).",
      });
      return;
    }

    next(error);
  }
}

export async function deleteFaydaData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const client = getSignifyClientFromRequest(req);
  const issuerAlias = getIssuerAliasFromRequest(req);
  const aid = String(req.query.aid || req.body?.aid || "").trim();
  const schemaSaid = getSchemaSaid(
    typeof req.query.schemaSaid === "string"
      ? req.query.schemaSaid
      : undefined,
    DEFAULT_FAYDA_SCHEMA_SAID
  );

  if (!aid) {
    res.status(400).send({
      success: false,
      data: "Missing holder AID. Send 'aid' in query string or request body.",
    });
    return;
  }

  try {
    const issuer = await client.identifiers().get(issuerAlias);
    const credentialsResponse = await client.credentials().list({
      filter: {
        "-a-i": aid,
      },
    });
    const credentials = getCredentialEntries(credentialsResponse);
    const targetCredentials = credentials.filter((credential) => {
      const credentialSchemaSaid = getCredentialSchemaSaid(credential);
      const holderAid = getCredentialHolderAid(credential);
      const sad = getCredentialSad(credential);
      const issuerAid = toTrimmedString(sad?.i);
      return (
        holderAid === aid &&
        credentialSchemaSaid === schemaSaid &&
        issuerAid === issuer.prefix
      );
    });

    if (targetCredentials.length === 0) {
      res.status(404).send({
        success: false,
        data: `No credential found for aid=${aid} and schemaSaid=${schemaSaid}`,
      });
      return;
    }

    const revokedCredentialIds: string[] = [];
    const alreadyRevokedCredentialIds: string[] = [];

    for (const credential of targetCredentials) {
      const credentialId = getCredentialId(credential);
      if (!credentialId) {
        continue;
      }

      if (isCredentialRevoked(credential)) {
        alreadyRevokedCredentialIds.push(credentialId);
        continue;
      }

      await client.credentials().revoke(issuerAlias, credentialId);

      let revokedCredential = await client.credentials().get(credentialId);
      let retries = 0;
      while (revokedCredential?.status?.s !== "1" && retries < 80) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        revokedCredential = await client.credentials().get(credentialId);
        retries += 1;
      }
      if (revokedCredential?.status?.s !== "1") {
        throw new Error(
          `Credential revocation not completed for credentialId=${credentialId}`
        );
      }

      const datetime = new Date().toISOString().replace("Z", "000+00:00");
      const [grant, gsigs, gend] = await client.ipex().grant({
        senderName: issuerAlias,
        recipient: aid,
        acdc: new Serder(revokedCredential.sad),
        anc: new Serder(revokedCredential.anc),
        iss: new Serder(revokedCredential.iss),
        datetime,
        ...buildGrantAttachments(revokedCredential as GenericCredential),
      });
      const submitGrantOp = await client
        .ipex()
        .submitGrant(issuerAlias, grant, gsigs, gend, [aid]);
      await waitAndGetDoneOp(client, submitGrantOp, OP_TIMEOUT);

      revokedCredentialIds.push(credentialId);
    }

    res.status(200).send({
      success: true,
      data: {
        aid,
        schemaSaid,
        revokedCredentialIds,
        alreadyRevokedCredentialIds,
      },
    });
  } catch (error) {
    next(error);
  }
}
