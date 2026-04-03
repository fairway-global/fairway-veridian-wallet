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
  ensureGeneratedSchemaForTemplate,
  getSchemaAttributesForSchemaId,
} from "../services/dashboardStore";
import { TemplateAttribute } from "../services/dashboardStore.types";
import {
  deleteFaydaVerificationByHolderAidForIssuer,
  getFaydaVerificationByHolderAidForIssuer,
  getAutoIssueTemplateByIssuer,
  getIssuerByAidPrefix,
  getIssuerByCode,
  upsertFaydaVerificationForIssuer,
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

const FAYDA_ATTRIBUTE_ALIASES: Record<string, string[]> = {
  address: ["address"],
  birthdate: ["birthdate", "dateofbirth", "dob"],
  country: ["nationality", "country", "citizenship"],
  dateofbirth: ["birthdate", "dateofbirth", "dob"],
  dob: ["birthdate", "dateofbirth", "dob"],
  email: ["email", "emailaddress", "mail"],
  emailaddress: ["email", "emailaddress", "mail"],
  faydaid: ["faydaid", "id", "sub", "nationalid"],
  fullname: ["name", "fullname", "displayname"],
  gender: ["gender", "sex"],
  id: ["faydaid", "id", "sub", "nationalid"],
  name: ["name", "fullname", "displayname"],
  nationalid: ["faydaid", "id", "sub", "nationalid"],
  nationality: ["nationality", "country", "citizenship"],
  phone: ["phonenumber", "phone", "mobile", "mobilenumber"],
  phonenumber: ["phonenumber", "phone", "mobile", "mobilenumber"],
  region: ["region"],
  sex: ["gender", "sex"],
  sub: ["faydaid", "id", "sub", "nationalid"],
  woreda: ["woreda"],
  zone: ["zone"],
};

type ResolvedFaydaRequestContext = {
  issuerId: string;
  client: SignifyClient;
  issuerAlias: string;
  qviCredentialId: string;
};

type FaydaAttributeMappingResult = {
  attribute: Record<string, unknown>;
  faydaId: string;
  missingRequiredFields: string[];
  mappedFields: string[];
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

function normalizeLookupKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return Boolean(value.trim());
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
}

function formatAddress(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const address = value as Record<string, unknown>;
  return [address.zone, address.woreda, address.region]
    .map((item) => toTrimmedString(item))
    .filter(Boolean)
    .join(", ");
}

function addLookupValue(
  lookup: Map<string, unknown>,
  key: string,
  value: unknown
): void {
  const normalizedKey = normalizeLookupKey(key);
  if (!normalizedKey || lookup.has(normalizedKey) || !hasMeaningfulValue(value)) {
    return;
  }

  lookup.set(normalizedKey, value);
}

function buildFaydaLookup(faydaData: FaydaData): Map<string, unknown> {
  const lookup = new Map<string, unknown>();

  Object.entries(faydaData).forEach(([key, value]) => {
    if (
      key === "picture" ||
      key === "additionalProp1" ||
      isBase64DataUri(value) ||
      !hasMeaningfulValue(value)
    ) {
      return;
    }

    addLookupValue(lookup, key, value);
  });

  const faydaId = extractFaydaId(faydaData);
  if (faydaId) {
    ["fayda_id", "faydaId", "id", "sub", "national_id", "nationalId"].forEach(
      (key) => addLookupValue(lookup, key, faydaId)
    );
  }

  const addressValue = (faydaData as Record<string, unknown>).address;
  if (addressValue && typeof addressValue === "object" && !Array.isArray(addressValue)) {
    const address = addressValue as Record<string, unknown>;
    addLookupValue(lookup, "address", formatAddress(address));
    addLookupValue(lookup, "zone", address.zone);
    addLookupValue(lookup, "woreda", address.woreda);
    addLookupValue(lookup, "region", address.region);
  }

  return lookup;
}

function getAttributeAliasCandidates(attributeName: string): string[] {
  const normalizedAttribute = normalizeLookupKey(attributeName);
  return Array.from(
    new Set([
      normalizedAttribute,
      ...(FAYDA_ATTRIBUTE_ALIASES[normalizedAttribute] || []),
    ])
  );
}

function toTemplateAttributeValue(
  rawValue: unknown,
  attribute: TemplateAttribute
): string | number | boolean | undefined {
  if (!hasMeaningfulValue(rawValue)) {
    return undefined;
  }

  if (attribute.type === "integer") {
    const parsed = Number.parseInt(String(rawValue).trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (attribute.type === "number") {
    const parsed = Number(String(rawValue).trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (attribute.type === "boolean") {
    if (typeof rawValue === "boolean") {
      return rawValue;
    }

    const normalized = toTrimmedString(rawValue).toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }

    return undefined;
  }

  if (typeof rawValue === "object") {
    const formattedAddress = formatAddress(rawValue);
    if (formattedAddress) {
      return formattedAddress;
    }
    return JSON.stringify(rawValue);
  }

  const normalized = toTrimmedString(rawValue);
  return normalized || undefined;
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

function mapFaydaDataToTemplateAttributes(
  attributes: TemplateAttribute[],
  faydaData: FaydaData
): FaydaAttributeMappingResult {
  const issuedAt = new Date().toISOString();
  const faydaId = extractFaydaId(faydaData);

  if (!faydaId) {
    throw new Error(
      "Missing required Fayda identifier. Provide faydaData.id, faydaData.fayda_id, or faydaData.sub."
    );
  }

  const lookup = buildFaydaLookup(faydaData);
  const attributePayload: Record<string, unknown> = {
    dt: issuedAt,
  };
  const missingRequiredFields: string[] = [];
  const mappedFields: string[] = [];

  for (const attribute of attributes) {
    const candidates = getAttributeAliasCandidates(attribute.name);
    const rawValue = candidates
      .map((candidate) => lookup.get(candidate))
      .find((value) => hasMeaningfulValue(value));

    const typedValue = toTemplateAttributeValue(rawValue, attribute);
    if (typedValue === undefined) {
      if (attribute.required) {
        missingRequiredFields.push(attribute.name);
      }
      continue;
    }

    attributePayload[attribute.name] = typedValue;
    mappedFields.push(attribute.name);
  }

  return {
    attribute: attributePayload,
    faydaId,
    missingRequiredFields,
    mappedFields,
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

function getFaydaTemplateAttributes(
  template: IssuerTemplateRecord | null,
  schemaSaid: string
): TemplateAttribute[] {
  if (template?.attributes?.length) {
    return template.attributes;
  }

  return getSchemaAttributesForSchemaId(schemaSaid);
}

function getFaydaSchemaCandidates(
  requestedSchema: string,
  autoIssueTemplate: IssuerTemplateRecord | null
): string[] {
  if (requestedSchema) {
    return [
      getSchemaSaid(
        requestedSchema,
        autoIssueTemplate?.schemaId || DEFAULT_FAYDA_SCHEMA_SAID
      ),
    ];
  }

  const candidates = [
    autoIssueTemplate ? canonicalSchemaId(autoIssueTemplate.schemaId) : "",
    DEFAULT_FAYDA_SCHEMA_SAID,
    ...STATUS_DEFAULT_SCHEMA_SAIDS,
  ]
    .map((item) => canonicalSchemaId(String(item || "").trim()))
    .filter(Boolean);

  return Array.from(new Set(candidates));
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
    if (autoIssueTemplate) {
      await ensureGeneratedSchemaForTemplate({
        schemaId: autoIssueTemplate.schemaId,
        name: autoIssueTemplate.name,
        attributes: autoIssueTemplate.attributes,
      }).catch(() => false);
    }
    const autoIssueConfigured = Boolean(autoIssueTemplate);
    const schemaSaid = requestedSchema
      ? getSchemaSaid(
          requestedSchema,
          autoIssueTemplate?.schemaId || DEFAULT_FAYDA_SCHEMA_SAID
        )
      : autoIssueTemplate
        ? canonicalSchemaId(autoIssueTemplate.schemaId)
        : "";
    const schemaCandidates = getFaydaSchemaCandidates(
      requestedSchema,
      autoIssueTemplate
    );

    const issuer = await client.identifiers().get(issuerAlias);
    const credentialsResponse = await client.credentials().list({
      filter: {
        "-a-i": aid,
      },
    });
    const credentials = getCredentialEntries(credentialsResponse);
    const storedVerification = issuerId
      ? await getFaydaVerificationByHolderAidForIssuer(issuerId, aid)
      : null;

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
    const verifiedCredentialId = verifiedCredential
      ? getCredentialId(verifiedCredential)
      : null;
    // Keep honoring persisted Fayda verification state even when the issued
    // credential is not returned in the latest list call yet. The issuer-side
    // saveFayda record is the source of truth for whether this holder has
    // already completed verification, and the wallet should not prompt them to
    // verify again just because credential lookup lagged or rotated.
    const persistedVerificationStatus = storedVerification?.status || null;
    const verificationStatus = verifiedCredential
      ? "credential_issued"
      : persistedVerificationStatus;
    const hasPersistedVerification = Boolean(persistedVerificationStatus);

    res.status(200).send({
      success: true,
      data: {
        aid,
        schemaSaid: schemaSaid || null,
        verified: Boolean(verifiedCredential || hasPersistedVerification),
        verifiedSchemaSaid: verifiedCredential
          ? getCredentialSchemaSaid(verifiedCredential)
          : null,
        verificationStatus,
        pendingManualReview: verificationStatus === "pending_manual_review",
        missingFields:
          verificationStatus === "pending_manual_review"
            ? storedVerification?.missingFields || []
            : [],
        credentialId:
          verifiedCredentialId || storedVerification?.credentialId || null,
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
    if (autoIssueTemplate) {
      await ensureGeneratedSchemaForTemplate({
        schemaId: autoIssueTemplate.schemaId,
        name: autoIssueTemplate.name,
        attributes: autoIssueTemplate.attributes,
      }).catch(() => false);
    }
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
    const faydaId = extractFaydaId(faydaData);
    const credentialName = String(
      body.credentialName || autoIssueTemplate?.name || "FaydaVerifiedAutoIssue"
    ).trim();
    const realtimeService = getRealtimeEventService(req);

    if (!faydaId) {
      res.status(400).send({
        success: false,
        data:
          "Missing required Fayda identifier. Provide faydaData.id, faydaData.fayda_id, or faydaData.sub.",
      });
      return;
    }

    if (!schemaSaid) {
      await upsertFaydaVerificationForIssuer({
        issuerId,
        holderAid: aid,
        faydaId,
        templateId: null,
        credentialId: null,
        status: "verified",
        missingFields: [],
        mappedData: {},
        faydaData,
      });

      if (realtimeService && issuerId) {
        realtimeService.publishToIssuer(issuerId, {
          type: "fayda.verified",
          payload: {
            action: "verified_without_auto_issue",
            holderDid: aid,
            faydaId,
          },
          notification: {
            title: "Fayda verified",
            message:
              `${aid} completed Fayda verification. ` +
              "No auto-issue template is configured for this issuer.",
            level: "info",
          },
        });
      }

      res.status(200).send({
        success: true,
        data: {
          message:
            "Fayda verification succeeded. No auto-issue template is configured, so no credential was issued.",
          credentialName: null,
          holderAid: aid,
          schemaSaid: null,
          faydaId,
          credentialId: null,
          alreadyIssued: false,
          autoIssueConfigured,
          autoIssued: false,
          verified: true,
          pendingManualReview: false,
          verificationStatus: "verified",
          missingFields: [],
        },
      });
      return;
    }
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
      await upsertFaydaVerificationForIssuer({
        issuerId,
        holderAid: aid,
        faydaId,
        templateId: autoIssueTemplate?.id || null,
        credentialId: verification.alreadyIssuedCredentialId,
        status: "credential_issued",
        missingFields: [],
        mappedData: {},
        faydaData,
      });

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
          pendingManualReview: false,
          verificationStatus: "credential_issued",
          missingFields: [],
        },
      });
      return;
    }

    const templateAttributes = getFaydaTemplateAttributes(
      autoIssueTemplate,
      schemaSaid
    );
    const attributeMapping = mapFaydaDataToTemplateAttributes(
      templateAttributes,
      faydaData
    );

    if (attributeMapping.missingRequiredFields.length > 0) {
      await upsertFaydaVerificationForIssuer({
        issuerId,
        holderAid: aid,
        faydaId,
        templateId: autoIssueTemplate?.id || null,
        credentialId: null,
        status: "pending_manual_review",
        missingFields: attributeMapping.missingRequiredFields,
        mappedData: attributeMapping.attribute,
        faydaData,
      });

      if (realtimeService && issuerId) {
        realtimeService.publishToIssuer(issuerId, {
          type: "fayda.manual_review_required",
          payload: {
            action: "manual_review_required",
            holderDid: aid,
            faydaId,
            templateId: autoIssueTemplate?.id || null,
            schemaSaid,
            missingFields: attributeMapping.missingRequiredFields,
            mappedFields: attributeMapping.mappedFields,
          },
          notification: {
            title: "Fayda credential needs manual completion",
            message:
              `${credentialName} for ${aid} is waiting for manual input. ` +
              `Missing required fields: ${attributeMapping.missingRequiredFields.join(", ")}.`,
            level: "warning",
          },
        });
      }

      res.status(200).send({
        success: true,
        data: {
          message:
            "Fayda verification succeeded, but the auto-issue template is missing required fields. The issuer must complete this credential manually.",
          credentialName,
          holderAid: aid,
          schemaSaid,
          faydaId,
          credentialId: null,
          alreadyIssued: false,
          autoIssueConfigured,
          autoIssued: false,
          verified: true,
          pendingManualReview: true,
          verificationStatus: "pending_manual_review",
          missingFields: attributeMapping.missingRequiredFields,
          mappedFields: attributeMapping.mappedFields,
        },
      });
      return;
    }

    const credentialId = await issueCredentialAndGrant(
      client,
      qviCredentialId,
      {
        schemaSaid,
        aid,
        attribute: attributeMapping.attribute,
      },
      {
        issuerName: issuerAlias,
      }
    );
    await upsertFaydaVerificationForIssuer({
      issuerId,
      holderAid: aid,
      faydaId,
      templateId: autoIssueTemplate?.id || null,
      credentialId,
      status: "credential_issued",
      missingFields: [],
      mappedData: attributeMapping.attribute,
      faydaData,
    });

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
        pendingManualReview: false,
        verificationStatus: "credential_issued",
        missingFields: [],
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
  const aid = String(req.query.aid || req.body?.aid || "").trim();
  const requestedSchema = toTrimmedString(
    typeof req.query.schemaSaid === "string"
      ? req.query.schemaSaid
      : req.body?.schemaSaid
  );

  if (!aid) {
    res.status(400).send({
      success: false,
      data: "Missing holder AID. Send 'aid' in query string or request body.",
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
    const schemaCandidates = getFaydaSchemaCandidates(
      requestedSchema,
      autoIssueTemplate
    );
    const responseSchemaSaid = requestedSchema
      ? getSchemaSaid(
          requestedSchema,
          autoIssueTemplate?.schemaId || DEFAULT_FAYDA_SCHEMA_SAID
        )
      : autoIssueTemplate
        ? canonicalSchemaId(autoIssueTemplate.schemaId)
        : DEFAULT_FAYDA_SCHEMA_SAID;
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
        schemaCandidates.includes(credentialSchemaSaid) &&
        issuerAid === issuer.prefix
      );
    });

    if (targetCredentials.length === 0) {
      await deleteFaydaVerificationByHolderAidForIssuer(issuerId, aid);
      res.status(200).send({
        success: true,
        data: {
          aid,
          schemaSaid: responseSchemaSaid,
          schemaCandidates,
          revokedCredentialIds: [],
          alreadyRevokedCredentialIds: [],
        },
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

    await deleteFaydaVerificationByHolderAidForIssuer(issuerId, aid);

    res.status(200).send({
      success: true,
      data: {
        aid,
        schemaSaid: responseSchemaSaid,
        schemaCandidates,
        revokedCredentialIds,
        alreadyRevokedCredentialIds,
      },
    });
  } catch (error) {
    next(error);
  }
}
