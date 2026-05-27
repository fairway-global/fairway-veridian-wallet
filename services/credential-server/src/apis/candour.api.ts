import { NextFunction, Request, Response } from "express";
import { SignifyClient } from "signify-ts";
import { issueCredentialAndGrant, UNKNOW_SCHEMA_ID } from "./credential.api";
import { config } from "../config";
import { canonicalSchemaId } from "../consts";
import {
  CandourResultResponse,
  createCandourVerificationSession,
  deleteCandourVerificationResult,
  getCandourVerificationResult,
} from "../services/candourClient";
import {
  ensureGeneratedSchemaForTemplate,
  getSchemaAttributesForSchemaId,
} from "../services/dashboardStore";
import { TemplateAttribute } from "../services/dashboardStore.types";
import { IssuerSignifyService } from "../services/issuerSignifyService";
import { RealtimeEventService } from "../services/realtimeEventService";
import {
  coerceTemplateAttributeValue,
  hasMeaningfulValue,
} from "../services/templateAttributeUtils";
import {
  deleteCandourVerificationByHolderAidForIssuer,
  deleteCandourVerificationsByHolderAid,
  getAutoIssueTemplateByIssuer,
  getCandourVerificationByHolderAidForIssuer,
  getIssuerByAidPrefix,
  getIssuerByCode,
  upsertCandourVerificationForIssuer,
} from "../services/tenantStore";
import { IssuerTemplateRecord } from "../services/tenantStore.types";
import {
  getIssuerAliasFromRequest,
  getQviCredentialIdFromRequest,
  getSignifyClientFromRequest,
} from "../utils/requestContext";

type SaveCandourDataRequest = {
  aid?: string;
  connectionId?: string;
  verificationSessionId?: string;
  candourData?: CandourData;
  issuerAid?: string;
  issuerCode?: string;
  callbackUrl?: string;
  identifier?: string;
};

type DeleteCandourDataRequest = {
  aid?: string;
  connectionId?: string;
  verificationSessionId?: string;
  issuerAid?: string;
  issuerCode?: string;
};

type CandourData = Partial<CandourResultResponse> & Record<string, unknown>;

type ResolvedCandourRequestContext = {
  issuerId: string;
  client: SignifyClient;
  issuerAlias: string;
  qviCredentialId: string;
};

type CandourAttributeMappingResult = {
  attribute: Record<string, unknown>;
  candourId: string;
  missingRequiredFields: string[];
  mappedFields: string[];
};

type CandourVerificationResult = {
  alreadyIssuedCredentialId?: string;
  conflictingCredentialId?: string;
  conflictingHolderAid?: string;
  conflictMessage?: string;
};

const CANDOUR_VERIFIED_STATUSES = new Set([
  "verified",
  "pending_manual_review",
  "credential_issued",
]);
const CANDOUR_FINISHED_STATUSES = new Set(["finished", "finishedManual"]);
const CANDOUR_ID_KEYS = [
  "nationalIdentificationNumber",
  "idNumber",
  "identifier",
] as const;

const CANDOUR_ATTRIBUTE_ALIASES: Record<string, string[]> = {
  birthdate: ["dateofbirth", "birthdate", "dob"],
  candourid: ["nationalidentificationnumber", "idnumber", "identifier"],
  country: ["idissuer", "issuingcountry", "country", "nationality"],
  dateofbirth: ["dateofbirth", "birthdate", "dob"],
  dob: ["dateofbirth", "birthdate", "dob"],
  firstname: ["firstname", "givenname"],
  fullname: ["name", "fullname", "displayname"],
  gender: ["sex", "gender"],
  iddocumenttype: ["iddocumenttype", "documenttype"],
  idexpiration: ["idexpiration", "expirationdate", "expirydate"],
  idissuer: ["idissuer", "issuingcountry", "country"],
  idnumber: ["idnumber", "documentnumber", "passportnumber", "identifier"],
  lastname: ["lastname", "surname", "familyname"],
  name: ["name", "fullname", "displayname"],
  nationalid: ["nationalidentificationnumber", "idnumber", "identifier"],
  nationalidentificationnumber: [
    "nationalidentificationnumber",
    "idnumber",
    "identifier",
  ],
  nationality: ["nationality", "citizenship", "country"],
  selfieimage: ["selfieimage", "selfie"],
  sex: ["sex", "gender"],
};

function toTrimmedString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getSubmittedCandourData(
  body: SaveCandourDataRequest
): CandourData | null {
  if (!isRecord(body.candourData)) {
    return null;
  }

  return body.candourData as CandourData;
}

function getCandourVerificationSessionId(
  body: SaveCandourDataRequest,
  submittedCandourData: CandourData | null
): string {
  return toTrimmedString(
    body.verificationSessionId || submittedCandourData?.verificationSessionId
  );
}

function normalizeCandourData(
  candourData: CandourData,
  verificationSessionId: string
): CandourData {
  return {
    ...candourData,
    verificationSessionId:
      toTrimmedString(candourData.verificationSessionId) ||
      verificationSessionId,
  };
}

function normalizeLookupKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getRealtimeEventService(req: Request): RealtimeEventService | null {
  return req.app.get("realtimeEventService") as RealtimeEventService | null;
}

function getCandourId(candourData: CandourData): string {
  for (const key of CANDOUR_ID_KEYS) {
    const value = toTrimmedString(candourData[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function addLookupValue(
  lookup: Map<string, unknown>,
  key: string,
  value: unknown
): void {
  const normalizedKey = normalizeLookupKey(key);
  if (
    !normalizedKey ||
    lookup.has(normalizedKey) ||
    !hasMeaningfulValue(value)
  ) {
    return;
  }

  lookup.set(normalizedKey, value);
}

function buildCandourLookup(candourData: CandourData): Map<string, unknown> {
  const lookup = new Map<string, unknown>();

  Object.entries(candourData).forEach(([key, value]) => {
    if (!hasMeaningfulValue(value)) {
      return;
    }

    addLookupValue(lookup, key, value);
  });

  const candourId = getCandourId(candourData);
  if (candourId) {
    [
      "candourId",
      "nationalIdentificationNumber",
      "idNumber",
      "identifier",
    ].forEach((key) => addLookupValue(lookup, key, candourId));
  }

  return lookup;
}

function getAttributeAliasCandidates(attributeName: string): string[] {
  const normalizedAttribute = normalizeLookupKey(attributeName);
  return Array.from(
    new Set([
      normalizedAttribute,
      ...(CANDOUR_ATTRIBUTE_ALIASES[normalizedAttribute] || []),
    ])
  );
}

function toTemplateAttributeValue(
  rawValue: unknown,
  attribute: TemplateAttribute
): string | number | boolean | undefined {
  if (typeof rawValue === "object" && attribute.type === "string") {
    return JSON.stringify(rawValue);
  }

  return coerceTemplateAttributeValue(rawValue, attribute);
}

function mapCandourDataToTemplateAttributes(
  attributes: TemplateAttribute[],
  candourData: CandourData
): CandourAttributeMappingResult {
  const candourId = getCandourId(candourData);
  if (!candourId) {
    throw new Error(
      "Missing required Candour identifier. Expected nationalIdentificationNumber, idNumber, or identifier."
    );
  }

  const lookup = buildCandourLookup(candourData);
  const attributePayload: Record<string, unknown> = {
    dt: new Date().toISOString(),
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
    candourId,
    missingRequiredFields,
    mappedFields,
  };
}

async function resolveCandourRequestContext(
  req: Request,
  issuerId: string
): Promise<ResolvedCandourRequestContext> {
  const normalizedIssuerId = toTrimmedString(issuerId);
  if (
    normalizedIssuerId &&
    req.issuerRuntime?.issuerId === normalizedIssuerId
  ) {
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

async function resolveIssuerIdForCandourRequest(req: Request): Promise<string> {
  const issuerId = toTrimmedString(
    req.authUser?.issuerId ||
      req.issuerRuntime?.issuerId ||
      req.gatewayToken?.issuerId
  );
  if (issuerId) {
    return issuerId;
  }

  const issuerAid = toTrimmedString(
    (req.body as SaveCandourDataRequest | undefined)?.issuerAid ||
      (req.query.issuerAid as string | undefined)
  );
  if (issuerAid) {
    const issuerByAid = await getIssuerByAidPrefix(issuerAid);
    if (issuerByAid?.id) {
      return toTrimmedString(issuerByAid.id);
    }
  }

  const issuerCode = toTrimmedString(
    (req.body as SaveCandourDataRequest | undefined)?.issuerCode ||
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

function hasExplicitCandourIssuerContext(req: Request): boolean {
  const body = req.body as
    | SaveCandourDataRequest
    | DeleteCandourDataRequest
    | undefined;

  return Boolean(
    toTrimmedString(
      req.authUser?.issuerId ||
        req.issuerRuntime?.issuerId ||
        req.gatewayToken?.issuerId ||
        body?.issuerAid ||
        (req.query.issuerAid as string | undefined) ||
        body?.issuerCode ||
        (req.query.issuerCode as string | undefined)
    )
  );
}

async function getAutoIssueTemplateForRequest(
  req: Request,
  issuerId?: string
): Promise<IssuerTemplateRecord | null> {
  const resolvedIssuerId = toTrimmedString(issuerId)
    ? toTrimmedString(issuerId)
    : await resolveIssuerIdForCandourRequest(req);
  if (!resolvedIssuerId) {
    return null;
  }

  return getAutoIssueTemplateByIssuer(resolvedIssuerId);
}

async function verifyCandourIdentifierForAutoIssue(
  client: SignifyClient,
  issuerAlias: string,
  holderAid: string,
  schemaSaid: string,
  candourId: string
): Promise<CandourVerificationResult> {
  const issuer = await client.identifiers().get(issuerAlias);
  const credentialsResponse = await client.credentials().list({
    filter: {
      "-i": issuer.prefix,
      "-s": { $eq: schemaSaid },
    },
  });
  const responseRecord = credentialsResponse as {
    credentials?: Array<{
      id?: string;
      sad?: { d?: string; a?: Record<string, unknown> };
      status?: { s?: string };
    }>;
  };
  const credentials = Array.isArray(credentialsResponse)
    ? (credentialsResponse as Array<{
        id?: string;
        sad?: { d?: string; a?: Record<string, unknown> };
        status?: { s?: string };
      }>)
    : Array.isArray(responseRecord.credentials)
    ? responseRecord.credentials
    : [];

  for (const credential of credentials) {
    if (toTrimmedString(credential.status?.s) === "1") {
      continue;
    }

    const attributes = credential.sad?.a || {};
    const credentialHolderAid = toTrimmedString(attributes.i);
    const credentialCandourId = toTrimmedString(
      attributes.nationalIdentificationNumber ||
        attributes.idNumber ||
        attributes.identifier ||
        attributes.candourId
    );
    const credentialId = toTrimmedString(credential.sad?.d || credential.id);

    if (!credentialId || !credentialHolderAid || !credentialCandourId) {
      continue;
    }

    if (
      credentialHolderAid === holderAid &&
      credentialCandourId === candourId
    ) {
      return {
        alreadyIssuedCredentialId: credentialId,
      };
    }

    if (
      credentialHolderAid !== holderAid &&
      credentialCandourId === candourId
    ) {
      return {
        conflictingCredentialId: credentialId,
        conflictingHolderAid: credentialHolderAid,
        conflictMessage:
          "Candour identity is already verified and linked to another holder.",
      };
    }

    if (
      credentialHolderAid === holderAid &&
      credentialCandourId !== candourId
    ) {
      return {
        conflictingCredentialId: credentialId,
        conflictingHolderAid: credentialHolderAid,
        conflictMessage:
          "Holder already has an active Candour verification credential with a different identity number.",
      };
    }
  }

  return {};
}

export async function createCandourSession(
  req: Request<{}, {}, SaveCandourDataRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const callbackUrl =
      toTrimmedString(req.body.callbackUrl) ||
      config.candour.defaultCallbackUrl;
    if (!callbackUrl) {
      res.status(400).send({
        success: false,
        data: "callbackUrl is required",
      });
      return;
    }

    const now = new Date();
    const validUntil = new Date(
      now.getTime() + config.candour.sessionTtlMinutes * 60 * 1000
    );
    const session = await createCandourVerificationSession({
      timestamp: now.toISOString(),
      validUntil: validUntil.toISOString(),
      tries: config.candour.maxTries,
      callbackUrl,
      allowedVerificationMethods: {
        rfidApp: config.candour.allowRfidApp,
        idApp: config.candour.allowIdApp,
        idWeb: config.candour.allowIdWeb,
      },
      allowedVerificationDocuments: {
        passport: true,
        idCard: config.candour.allowIdCard,
      },
      resultProperties: {
        name: true,
        dateOfBirth: true,
        nationalIdentificationNumber: true,
        idNumber: true,
        idDocumentType: true,
        idExpiration: true,
        idIssuer: true,
        nationality: true,
        sex: true,
        selfieImage: true,
        idMrzImage: true,
        idOtherImage: true,
        idChipImage: true,
      },
      user: req.body.identifier
        ? {
            identifier: toTrimmedString(req.body.identifier),
          }
        : undefined,
    });

    res.status(200).send({
      success: true,
      data: {
        ...session,
        validUntil: validUntil.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCandourDataStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const aid = toTrimmedString(req.query.aid);
  if (!aid) {
    res.status(400).send({
      success: false,
      data: "Missing holder AID. Send 'aid' as query parameter.",
    });
    return;
  }

  try {
    const issuerId = await resolveIssuerIdForCandourRequest(req);
    const autoIssueTemplate = await getAutoIssueTemplateForRequest(
      req,
      issuerId
    );
    if (autoIssueTemplate) {
      await ensureGeneratedSchemaForTemplate({
        schemaId: autoIssueTemplate.schemaId,
        name: autoIssueTemplate.name,
        attributes: autoIssueTemplate.attributes,
      }).catch(() => false);
    }

    const storedVerification = issuerId
      ? await getCandourVerificationByHolderAidForIssuer(issuerId, aid)
      : null;
    const verificationStatus = storedVerification?.status || null;
    const verified = Boolean(
      verificationStatus && CANDOUR_VERIFIED_STATUSES.has(verificationStatus)
    );

    res.status(200).send({
      success: true,
      data: {
        aid,
        verified,
        verificationStatus,
        pendingManualReview: verificationStatus === "pending_manual_review",
        missingFields:
          verificationStatus === "pending_manual_review"
            ? storedVerification?.missingFields || []
            : [],
        credentialId: storedVerification?.credentialId || null,
        autoIssueConfigured: Boolean(autoIssueTemplate),
        autoIssueTemplateId: autoIssueTemplate?.id || null,
        verificationSessionId:
          storedVerification?.verificationSessionId || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function saveCandourData(
  req: Request<{}, {}, SaveCandourDataRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const body = req.body;
  const aid = toTrimmedString(body.aid || body.connectionId);
  const submittedCandourData = getSubmittedCandourData(body);
  const verificationSessionId = getCandourVerificationSessionId(
    body,
    submittedCandourData
  );

  if (!aid) {
    res.status(400).send({
      success: false,
      data: "Missing holder AID. Send 'aid' or 'connectionId' in request body.",
    });
    return;
  }

  if (!verificationSessionId) {
    res.status(400).send({
      success: false,
      data: "Missing verificationSessionId. Send 'verificationSessionId' or 'candourData.verificationSessionId' in request body.",
    });
    return;
  }

  const submittedSessionId = toTrimmedString(
    submittedCandourData?.verificationSessionId
  );
  const requestSessionId = toTrimmedString(body.verificationSessionId);
  if (
    submittedCandourData &&
    submittedSessionId &&
    requestSessionId &&
    submittedSessionId !== requestSessionId
  ) {
    res.status(400).send({
      success: false,
      data: "verificationSessionId must match candourData.verificationSessionId when both are provided.",
    });
    return;
  }

  try {
    const issuerId = await resolveIssuerIdForCandourRequest(req);
    const { client, qviCredentialId, issuerAlias } =
      await resolveCandourRequestContext(req, issuerId);
    const autoIssueTemplate = await getAutoIssueTemplateForRequest(
      req,
      issuerId
    );
    if (autoIssueTemplate) {
      await ensureGeneratedSchemaForTemplate({
        schemaId: autoIssueTemplate.schemaId,
        name: autoIssueTemplate.name,
        attributes: autoIssueTemplate.attributes,
      }).catch(() => false);
    }

    const realtimeService = getRealtimeEventService(req);
    const candourData = submittedCandourData
      ? normalizeCandourData(submittedCandourData, verificationSessionId)
      : ((await getCandourVerificationResult(
          verificationSessionId
        )) as CandourData);

    if (!CANDOUR_FINISHED_STATUSES.has(toTrimmedString(candourData.status))) {
      res.status(409).send({
        success: false,
        data: {
          message: `Candour verification is not complete yet. Current status: ${
            toTrimmedString(candourData.status) || "unknown"
          }.`,
          verificationSessionId,
          status: candourData.status || null,
        },
      });
      return;
    }

    if (!candourData.identityVerified) {
      res.status(409).send({
        success: false,
        data: {
          message:
            "Candour verification finished without a successful identity match.",
          verificationSessionId,
          status: candourData.status || null,
          errors: Array.isArray(candourData.errors) ? candourData.errors : [],
        },
      });
      return;
    }

    const autoIssueConfigured = Boolean(autoIssueTemplate);
    const candourId = getCandourId(candourData);
    if (!candourId) {
      res.status(400).send({
        success: false,
        data: "Missing required Candour identifier. Expected nationalIdentificationNumber, idNumber, or identifier.",
      });
      return;
    }

    if (!autoIssueTemplate) {
      await upsertCandourVerificationForIssuer({
        issuerId,
        holderAid: aid,
        candourId,
        verificationSessionId,
        templateId: null,
        credentialId: null,
        status: "verified",
        missingFields: [],
        mappedData: {},
        candourData,
      });

      if (realtimeService && issuerId) {
        realtimeService.publishToIssuer(issuerId, {
          type: "candour.verified",
          payload: {
            action: "verified_without_auto_issue",
            holderDid: aid,
            candourId,
            verificationSessionId,
          },
          notification: {
            title: "Candour verified",
            message:
              `${aid} completed Candour verification. ` +
              "No auto-issue template is configured for this issuer.",
            level: "info",
          },
        });
      }

      void deleteCandourVerificationResult(verificationSessionId).catch(
        () => undefined
      );

      res.status(200).send({
        success: true,
        data: {
          message:
            "Candour verification succeeded. No auto-issue template is configured, so no credential was issued.",
          credentialName: null,
          holderAid: aid,
          candourId,
          credentialId: null,
          alreadyIssued: false,
          autoIssueConfigured,
          autoIssued: false,
          verified: true,
          pendingManualReview: false,
          verificationStatus: "verified",
          missingFields: [],
          verificationSessionId,
        },
      });
      return;
    }

    const verification = await verifyCandourIdentifierForAutoIssue(
      client,
      issuerAlias,
      aid,
      canonicalSchemaId(autoIssueTemplate.schemaId),
      candourId
    );

    if (verification.conflictingCredentialId) {
      res.status(409).send({
        success: false,
        data: {
          message:
            verification.conflictMessage ||
            "Candour verification conflict detected.",
          candourId,
          verificationSessionId,
          conflictingCredentialId: verification.conflictingCredentialId,
          conflictingHolderAid: verification.conflictingHolderAid || null,
          autoIssueConfigured,
        },
      });
      return;
    }

    if (verification.alreadyIssuedCredentialId) {
      await upsertCandourVerificationForIssuer({
        issuerId,
        holderAid: aid,
        candourId,
        verificationSessionId,
        templateId: autoIssueTemplate.id || null,
        credentialId: verification.alreadyIssuedCredentialId,
        status: "credential_issued",
        missingFields: [],
        mappedData: {},
        candourData,
      });

      void deleteCandourVerificationResult(verificationSessionId).catch(
        () => undefined
      );

      res.status(200).send({
        success: true,
        data: {
          message: "Candour already verified. Credential is already active.",
          credentialName: autoIssueTemplate.name,
          holderAid: aid,
          candourId,
          credentialId: verification.alreadyIssuedCredentialId,
          alreadyIssued: true,
          autoIssueConfigured,
          autoIssued: false,
          verified: true,
          pendingManualReview: false,
          verificationStatus: "credential_issued",
          missingFields: [],
          verificationSessionId,
        },
      });
      return;
    }

    const templateAttributes = autoIssueTemplate.attributes?.length
      ? autoIssueTemplate.attributes
      : getSchemaAttributesForSchemaId(autoIssueTemplate.schemaId);
    const attributeMapping = mapCandourDataToTemplateAttributes(
      templateAttributes,
      candourData
    );

    if (attributeMapping.missingRequiredFields.length > 0) {
      await upsertCandourVerificationForIssuer({
        issuerId,
        holderAid: aid,
        candourId,
        verificationSessionId,
        templateId: autoIssueTemplate.id || null,
        credentialId: null,
        status: "pending_manual_review",
        missingFields: attributeMapping.missingRequiredFields,
        mappedData: attributeMapping.attribute,
        candourData,
      });

      if (realtimeService && issuerId) {
        realtimeService.publishToIssuer(issuerId, {
          type: "candour.manual_review_required",
          payload: {
            action: "manual_review_required",
            holderDid: aid,
            candourId,
            verificationSessionId,
            templateId: autoIssueTemplate.id || null,
            missingFields: attributeMapping.missingRequiredFields,
            mappedFields: attributeMapping.mappedFields,
          },
          notification: {
            title: "Candour credential needs manual completion",
            message:
              `${autoIssueTemplate.name} for ${aid} is waiting for manual input. ` +
              `Missing required fields: ${attributeMapping.missingRequiredFields.join(
                ", "
              )}.`,
            level: "warning",
          },
        });
      }

      void deleteCandourVerificationResult(verificationSessionId).catch(
        () => undefined
      );

      res.status(200).send({
        success: true,
        data: {
          message:
            "Candour verification succeeded, but the auto-issue template is missing required fields. The issuer must complete this credential manually.",
          credentialName: autoIssueTemplate.name,
          holderAid: aid,
          candourId,
          credentialId: null,
          alreadyIssued: false,
          autoIssueConfigured,
          autoIssued: false,
          verified: true,
          pendingManualReview: true,
          verificationStatus: "pending_manual_review",
          missingFields: attributeMapping.missingRequiredFields,
          mappedFields: attributeMapping.mappedFields,
          verificationSessionId,
        },
      });
      return;
    }

    const credentialId = await issueCredentialAndGrant(
      client,
      qviCredentialId,
      {
        schemaSaid: autoIssueTemplate.schemaId,
        aid,
        attribute: attributeMapping.attribute,
      },
      {
        issuerName: issuerAlias,
      }
    );

    await upsertCandourVerificationForIssuer({
      issuerId,
      holderAid: aid,
      candourId,
      verificationSessionId,
      templateId: autoIssueTemplate.id || null,
      credentialId,
      status: "credential_issued",
      missingFields: [],
      mappedData: attributeMapping.attribute,
      candourData,
    });

    if (realtimeService && issuerId) {
      realtimeService.publishToIssuer(issuerId, {
        type: "credentials.refresh",
        payload: {
          credentialId,
          action: "issued_auto_candour",
          holderDid: aid,
          verificationSessionId,
        },
        notification: {
          title: "Credential issued",
          message: `${autoIssueTemplate.name} was auto-issued after Candour verification.`,
          level: "success",
        },
      });
    }

    void deleteCandourVerificationResult(verificationSessionId).catch(
      () => undefined
    );

    res.status(200).send({
      success: true,
      data: {
        message:
          "Candour verification succeeded and credential offer was sent automatically.",
        credentialName: autoIssueTemplate.name,
        holderAid: aid,
        candourId,
        credentialId,
        alreadyIssued: false,
        autoIssueConfigured,
        autoIssued: true,
        verified: true,
        pendingManualReview: false,
        verificationStatus: "credential_issued",
        missingFields: [],
        verificationSessionId,
      },
    });
  } catch (error: unknown) {
    const message = String((error as Error)?.message ?? error ?? "");
    const normalized = message.toLowerCase();
    if (
      message.includes("Missing required Candour identifier") ||
      normalized.includes("candour is not configured")
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
      normalized.includes(
        "must be loaded with data oobi before issuing credentials"
      ) ||
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

export async function deleteCandourData(
  req: Request<{}, {}, DeleteCandourDataRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const aid = toTrimmedString(
    req.query.aid || req.body?.aid || req.body?.connectionId
  );
  const verificationSessionId = toTrimmedString(
    req.query.verificationSessionId || req.body?.verificationSessionId
  );

  if (!aid) {
    res.status(400).send({
      success: false,
      data: "Missing holder AID. Send 'aid' in query string or request body, or 'connectionId' in request body.",
    });
    return;
  }

  try {
    const issuerScopedDelete = hasExplicitCandourIssuerContext(req);
    const issuerId = issuerScopedDelete
      ? await resolveIssuerIdForCandourRequest(req)
      : "";
    const deletedVerificationCount = issuerScopedDelete
      ? (await deleteCandourVerificationByHolderAidForIssuer(issuerId, aid))
        ? 1
        : 0
      : await deleteCandourVerificationsByHolderAid(aid);
    const deletedVerification = deletedVerificationCount > 0;
    let deletedCandourResult: boolean | null = null;
    let candourDeleteError: string | null = null;

    if (verificationSessionId) {
      try {
        await deleteCandourVerificationResult(verificationSessionId);
        deletedCandourResult = true;
      } catch (error) {
        deletedCandourResult = false;
        candourDeleteError = String((error as Error)?.message ?? error ?? "");
      }
    }

    res.status(200).send({
      success: true,
      data: {
        aid,
        issuerId: issuerId || null,
        issuerScopedDelete,
        verificationSessionId: verificationSessionId || null,
        deletedVerification,
        deletedVerificationCount,
        deletedCandourResult,
        candourDeleteError,
      },
    });
  } catch (error) {
    next(error);
  }
}
