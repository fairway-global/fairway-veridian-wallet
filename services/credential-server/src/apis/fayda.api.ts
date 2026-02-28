import { NextFunction, Request, Response } from "express";
import { Serder, SignifyClient } from "signify-ts";
import {
  FAYDA_FAIRWAY_ID_SCHEMA_SAID,
  ISSUER_NAME,
} from "../consts";
import { issueCredentialAndGrant, UNKNOW_SCHEMA_ID } from "./credential.api";
import { OP_TIMEOUT, waitAndGetDoneOp } from "../utils/utils";

type FaydaData = {
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

const REQUIRED_FAYDA_FIELDS = [
  "name",
  "email",
  "phone_number",
  "birthdate",
  "gender",
] as const;

function toTrimmedString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function isBase64DataUri(value: unknown): boolean {
  return typeof value === "string" && /^data:[^;]+;base64,/i.test(value);
}

function buildAttribute(faydaData: FaydaData): Record<string, unknown> {
  const issuedAt = new Date().toISOString();

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
        key !== "picture" &&
        !isBase64DataUri(value) &&
        value !== undefined &&
        value !== null
      );
    })
  );

  return {
    dt: issuedAt,
    ...normalized,
    ...extraFields,
  };
}

function getCredentialEntries(listResponse: unknown): any[] {
  if (Array.isArray(listResponse)) {
    return listResponse;
  }
  if (!listResponse || typeof listResponse !== "object") {
    return [];
  }

  const data = listResponse as Record<string, unknown>;
  const candidates = [data.credentials, data.items, data.data];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as any[];
    }
  }

  return [];
}

function getCredentialSad(credential: any): Record<string, any> {
  return (
    credential?.sad ||
    credential?.acdc?.sad ||
    credential?.acdc ||
    {}
  );
}

function getCredentialId(credential: any): string {
  const sad = getCredentialSad(credential);
  return String(sad?.d || credential?.id || "").trim();
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

function buildGrantAttachments(credential: any): {
  acdcAttachment?: string;
  ancAttachment?: string;
  issAttachment?: string;
} {
  return {
    acdcAttachment: toAttachment(credential?.atc ?? credential?.acdcAttachment),
    ancAttachment: toAttachment(
      credential?.ancatc ?? credential?.ancAttachment
    ),
    issAttachment: toAttachment(
      credential?.issAtc ?? credential?.issatc ?? credential?.issAttachment
    ),
  };
}

function getSchemaSaid(
  payloadSchemaSaid: string | undefined,
  fallbackSchema: string
): string {
  return String(payloadSchemaSaid || process.env.FAYDA_SCHEMA_SAID || fallbackSchema).trim();
}

export async function getFaydaDataStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const client: SignifyClient = req.app.get("signifyClient");
  const aid = String(req.query.aid || "").trim();
  const schemaSaid = getSchemaSaid(
    typeof req.query.schemaSaid === "string" ? req.query.schemaSaid : undefined,
    FAYDA_FAIRWAY_ID_SCHEMA_SAID
  );

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

    const verified = credentials.some((credential) => {
      const sad = credential?.sad || credential?.acdc?.sad || {};
      const status = credential?.status?.s;
      return (
        sad?.a?.i === aid &&
        sad?.s === schemaSaid &&
        sad?.i === issuer.prefix &&
        status !== "1"
      );
    });

    res.status(200).send({
      success: true,
      data: {
        aid,
        schemaSaid,
        verified,
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
  const schemaSaid = FAYDA_FAIRWAY_ID_SCHEMA_SAID;
  const faydaData = body.faydaData || {};
  const credentialName = String(
    body.credentialName || "FaydaVerifiedFairwayId"
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

    // SSI note: we intentionally do not persist raw Fayda payload server-side.
    await issueCredentialAndGrant(client, qviCredentialId, {
      schemaSaid,
      aid,
      attribute,
    });

    res.status(200).send({
      success: true,
      data: {
        message: "Fayda data processed and credential offer sent",
        credentialName,
        holderAid: aid,
        schemaSaid,
      },
    });
  } catch (error: any) {
    const message = String(error?.message ?? error ?? "");
    if (message.includes("Missing required Fayda fields")) {
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
    typeof req.query.schemaSaid === "string" ? req.query.schemaSaid : undefined,
    FAYDA_FAIRWAY_ID_SCHEMA_SAID
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
      const sad = getCredentialSad(credential);
      return (
        sad?.a?.i === aid &&
        sad?.s === schemaSaid &&
        sad?.i === issuer.prefix
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

      const status = String(credential?.status?.s || "");
      if (status === "1") {
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
        ...buildGrantAttachments(revokedCredential),
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
