import { NextFunction, Request, Response } from "express";
import { Serder, SignifyClient } from "signify-ts";
<<<<<<< Updated upstream
import { FAYDA_FAIRWAY_ID_SCHEMA_SAID, ISSUER_NAME } from "../consts";
=======
import {
  canonicalSchemaId,
  FAYDA_AUTO_VERIFIED_SCHEMA_SAID,
  FAYDA_FAIRWAY_ID_SCHEMA_SAID,
  ISSUER_NAME,
} from "../consts";
>>>>>>> Stashed changes
import { issueCredentialAndGrant, UNKNOW_SCHEMA_ID } from "./credential.api";
import { OP_TIMEOUT, waitAndGetDoneOp } from "../utils/utils";

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

<<<<<<< Updated upstream
function getCredentialSad(credential: any): Record<string, any> {
  return credential?.sad || credential?.acdc?.sad || credential?.acdc || {};
=======
function getCredentialSad(credential: GenericCredential): Record<string, unknown> {
  return credential.sad || credential.acdc?.sad || credential.acdc || {};
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  return String(
    payloadSchemaSaid || process.env.FAYDA_SCHEMA_SAID || fallbackSchema
  ).trim();
=======
  return canonicalSchemaId(
    String(
    payloadSchemaSaid || process.env.FAYDA_SCHEMA_SAID || fallbackSchema
    ).trim()
  );
}

type FaydaVerificationResult = {
  alreadyIssuedCredentialId?: string;
  conflictingCredentialId?: string;
  conflictingHolderAid?: string;
  conflictMessage?: string;
};

async function verifyFaydaIdentifierForAutoIssue(
  client: SignifyClient,
  holderAid: string,
  schemaSaid: string,
  faydaId: string
): Promise<FaydaVerificationResult> {
  const issuer = await client.identifiers().get(ISSUER_NAME);
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
>>>>>>> Stashed changes
}

export async function getFaydaDataStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const client: SignifyClient = req.app.get("signifyClient");
  const aid = String(req.query.aid || "").trim();
  const requestedSchema = toTrimmedString(req.query.schemaSaid);
  const schemaSaid = getSchemaSaid(requestedSchema, DEFAULT_FAYDA_SCHEMA_SAID);
  const schemaCandidates = requestedSchema
    ? [schemaSaid]
    : STATUS_DEFAULT_SCHEMA_SAIDS;

  if (!aid) {
    res.status(400).send({
      success: false,
      data: "Missing holder AID. Send 'aid' as query parameter.",
    });
    return;
  }

  try {
    const issuer = await client.identifiers().get(ISSUER_NAME);
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
        schemaSaid,
        verified: Boolean(verifiedCredential),
        verifiedSchemaSaid: verifiedCredential
          ? getCredentialSchemaSaid(verifiedCredential)
          : null,
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
  const client: SignifyClient = req.app.get("signifyClient");
  const qviCredentialId: string = req.app.get("qviCredentialId");

  const body = req.body as SaveFaydaDataRequest;
  const aid = String(body.aid || body.connectionId || "").trim();
  const schemaSaid = getSchemaSaid(body.schemaSaid, DEFAULT_FAYDA_SCHEMA_SAID);
  const faydaData = body.faydaData || {};
  const credentialName = String(
    body.credentialName || "FaydaVerifiedAutoIssue"
  ).trim();

  if (!aid) {
    res.status(400).send({
      success: false,
      data: "Missing holder AID. Send 'aid' or 'connectionId' in request body.",
    });
    return;
  }

  try {
    const attribute = buildAttribute(faydaData);
    const faydaId = toTrimmedString(attribute.fayda_id);
    const verification = await verifyFaydaIdentifierForAutoIssue(
      client,
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
          verified: true,
        },
      });
      return;
    }

    const credentialId = await issueCredentialAndGrant(client, qviCredentialId, {
      schemaSaid,
      aid,
      attribute,
    });

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
  const client: SignifyClient = req.app.get("signifyClient");
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
    const issuer = await client.identifiers().get(ISSUER_NAME);
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
<<<<<<< Updated upstream
        sad?.a?.i === aid && sad?.s === schemaSaid && sad?.i === issuer.prefix
=======
        holderAid === aid &&
        credentialSchemaSaid === schemaSaid &&
        issuerAid === issuer.prefix
>>>>>>> Stashed changes
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

      await client.credentials().revoke(ISSUER_NAME, credentialId);

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
        senderName: ISSUER_NAME,
        recipient: aid,
        acdc: new Serder(revokedCredential.sad),
        anc: new Serder(revokedCredential.anc),
        iss: new Serder(revokedCredential.iss),
        datetime,
        ...buildGrantAttachments(revokedCredential as GenericCredential),
      });
      const submitGrantOp = await client
        .ipex()
        .submitGrant(ISSUER_NAME, grant, gsigs, gend, [aid]);
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
