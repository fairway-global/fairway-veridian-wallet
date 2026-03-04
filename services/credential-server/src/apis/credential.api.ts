import { NextFunction, Request, Response } from "express";
import { Operation, Saider, Serder, SignifyClient } from "signify-ts";
import { config } from "../config";
import { canonicalSchemaId, ISSUER_NAME, LE_SCHEMA_SAID } from "../consts";
import { isSchemaIdKnown } from "../services/dashboardStore";
import {
  getRegistry,
  OP_TIMEOUT,
  resolveOobi,
  waitAndGetDoneOp,
} from "../utils/utils";
import { QviCredential } from "../utils/utils.types";

export const UNKNOW_SCHEMA_ID = "Unknow Schema ID: ";
export const CREDENTIAL_NOT_FOUND = "Not found credential with ID: ";
export const CREDENTIAL_REVOKED_ALREADY =
  "The credential has been revoked already";

interface IssueAcdcCredentialInput {
  schemaSaid: string;
  aid: string;
  attribute?: Record<string, unknown>;
}

const SCHEMA_LOAD_TIMEOUT_MS = 10000;
const SCHEMA_LOAD_POLL_INTERVAL_MS = 250;

type CredentialRecord = {
  id?: string;
  status?: {
    s?: string;
  };
  sad?: {
    d?: string;
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

function ensureTrailingPath(baseUrl: string, schemaSaid: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/oobi/${schemaSaid}`;
}

function buildSchemaOobiCandidates(schemaSaid: string): string[] {
  const rawBases = [
    String(config.oobiEndpoint || "").trim(),
    String(config.endpoint || "").trim(),
    String(process.env.PUBLIC_OOBI_ENDPOINT || "").trim(),
  ].filter(Boolean);

  const withHostVariants = rawBases.flatMap((base) => {
    try {
      const parsed = new URL(base);
      const variants = [base];

      if (parsed.hostname === "localhost") {
        const localhostVariant = new URL(base);
        localhostVariant.hostname = "127.0.0.1";
        variants.push(localhostVariant.toString());

        const dockerVariant = new URL(base);
        dockerVariant.hostname = "host.docker.internal";
        variants.push(dockerVariant.toString());

        const bridgeVariant = new URL(base);
        bridgeVariant.hostname = "172.17.0.1";
        variants.push(bridgeVariant.toString());
      } else if (parsed.hostname === "127.0.0.1") {
        const loopbackVariant = new URL(base);
        loopbackVariant.hostname = "localhost";
        variants.push(loopbackVariant.toString());

        const dockerVariant = new URL(base);
        dockerVariant.hostname = "host.docker.internal";
        variants.push(dockerVariant.toString());

        const bridgeVariant = new URL(base);
        bridgeVariant.hostname = "172.17.0.1";
        variants.push(bridgeVariant.toString());
      }

      return variants;
    } catch {
      return [base];
    }
  });

  return Array.from(
    new Set(withHostVariants.map((base) => ensureTrailingPath(base, schemaSaid)))
  );
}

function isSchemaNotLoadedError(message: string, schemaSaid: string): boolean {
  const normalized = String(message || "");
  return (
    normalized.includes(`Credential schema ${schemaSaid} not found`) ||
    normalized.includes("must be loaded with data oobi before issuing credentials")
  );
}

async function isSchemaLoaded(
  client: SignifyClient,
  schemaSaid: string
): Promise<boolean> {
  try {
    await client.schemas().get(schemaSaid);
    return true;
  } catch {
    return false;
  }
}

async function waitForSchemaLoaded(
  client: SignifyClient,
  schemaSaid: string
): Promise<boolean> {
  const deadline = Date.now() + SCHEMA_LOAD_TIMEOUT_MS;
  while (Date.now() <= deadline) {
    if (await isSchemaLoaded(client, schemaSaid)) {
      return true;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, SCHEMA_LOAD_POLL_INTERVAL_MS)
    );
  }

  return false;
}

async function ensureSchemaLoaded(
  client: SignifyClient,
  schemaSaid: string
): Promise<void> {
  if (await isSchemaLoaded(client, schemaSaid)) {
    return;
  }

  const candidates = buildSchemaOobiCandidates(schemaSaid);

  for (const candidate of candidates) {
    try {
      await resolveOobi(client, candidate);
      const loaded = await waitForSchemaLoaded(client, schemaSaid);
      if (loaded) {
        return;
      }
    } catch {
      // continue with next candidate
    }
  }

  throw new Error(
    `Credential schema ${schemaSaid} not loaded. Configure OOBI_ENDPOINT to a hostname reachable from KERIA (current: ${config.oobiEndpoint}). Tried OOBI URLs: ${candidates.join(
      ", "
    )}`
  );
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

function buildGrantAttachments(credential: CredentialRecord): {
  acdcAttachment?: string;
  ancAttachment?: string;
  issAttachment?: string;
} {
  return {
    acdcAttachment: toAttachment(credential.atc ?? credential.acdcAttachment),
    ancAttachment: toAttachment(credential.ancatc ?? credential.ancAttachment),
    issAttachment: toAttachment(
      credential.issAtc ?? credential.issatc ?? credential.issAttachment
    ),
  };
}

export function getCredentialEntries(listResponse: unknown): CredentialRecord[] {
  if (Array.isArray(listResponse)) {
    return listResponse as CredentialRecord[];
  }

  if (!listResponse || typeof listResponse !== "object") {
    return [];
  }

  const data = listResponse as Record<string, unknown>;
  const candidates = [data.credentials, data.items, data.data];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as CredentialRecord[];
    }
  }

  return [];
}

export function getCredentialId(credential: CredentialRecord): string {
  return String(credential.sad?.d || credential.id || "").trim();
}

export async function issueCredentialAndGrant(
  client: SignifyClient,
  qviCredentialId: string,
  input: IssueAcdcCredentialInput
): Promise<string> {
  const requestedSchemaSaid = String(input.schemaSaid || "").trim();
  const schemaSaid = canonicalSchemaId(requestedSchemaSaid);
  const { aid, attribute } = input;

  if (!isSchemaIdKnown(schemaSaid)) {
    throw new Error(`${UNKNOW_SCHEMA_ID}${requestedSchemaSaid}`);
  }

  await ensureSchemaLoaded(client, schemaSaid);

  const keriRegistryRegk = await getRegistry(client, ISSUER_NAME);
  const holderAid = await client.identifiers().get(ISSUER_NAME);

  let issueParams: any;
  let grantParams: any;

  if (schemaSaid === LE_SCHEMA_SAID) {
    const qviCredential: QviCredential = await client
      .credentials()
      .get(qviCredentialId);

    issueParams = {
      ri: keriRegistryRegk,
      s: LE_SCHEMA_SAID,
      a: {
        i: aid,
        ...attribute,
      },
      r: Saider.saidify({
        d: "",
        usageDisclaimer: {
          l: "Usage of a valid, unexpired, and non-revoked vLEI Credential, as defined in the associated Ecosystem Governance Framework, does not assert that the Legal Entity is trustworthy, honest, reputable in its business dealings, safe to do business with, or compliant with any laws or that an implied or expressly intended purpose will be fulfilled.",
        },
        issuanceDisclaimer: {
          l: "All information in a valid, unexpired, and non-revoked vLEI Credential, as defined in the associated Ecosystem Governance Framework, is accurate as of the date the validation process was complete. The vLEI Credential has been issued to the legal entity or person named in the vLEI Credential as the subject; and the qualified vLEI Issuer exercised reasonable care to perform the validation process set forth in the vLEI Ecosystem Governance Framework.",
        },
      })[1],
      e: Saider.saidify({
        d: "",
        qvi: {
          n: qviCredential.sad.d,
          s: qviCredential.sad.s,
        },
      })[1],
    };

    grantParams = {
      senderName: holderAid.name,
      recipient: aid,
    };
  } else {
    issueParams = {
      ri: keriRegistryRegk,
      s: schemaSaid,
      a: {
        i: aid,
        ...attribute,
      },
    };

    grantParams = {
      senderName: ISSUER_NAME,
      recipient: aid,
    };
  }

  const issuerName =
    schemaSaid === LE_SCHEMA_SAID ? holderAid.name : ISSUER_NAME;
  let result;
  try {
    result = await client.credentials().issue(issuerName, issueParams);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isSchemaNotLoadedError(message, schemaSaid)) {
      throw error;
    }

    await ensureSchemaLoaded(client, schemaSaid);

    result = await client.credentials().issue(issuerName, issueParams);
  }
  await waitAndGetDoneOp(client, result.op, OP_TIMEOUT);

  const credential = await client.credentials().get(result.acdc.ked.d);
  const datetime = new Date().toISOString().replace("Z", "000+00:00");
  const [grant, gsigs, gend] = await client.ipex().grant({
    ...grantParams,
    acdc: new Serder(credential.sad),
    anc: new Serder(credential.anc),
    iss: new Serder(credential.iss),
    ...buildGrantAttachments(credential),
    datetime,
  });

  await client
    .ipex()
    .submitGrant(grantParams.senderName, grant, gsigs, gend, [aid]);

  return result.acdc.ked.d;
}

export async function issueAcdcCredential(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const client: SignifyClient = req.app.get("signifyClient");
  const qviCredentialId = req.app.get("qviCredentialId");

  const { schemaSaid, aid, attribute } = req.body;
  const normalizedSchemaSaid = canonicalSchemaId(String(schemaSaid || "").trim());

  if (!isSchemaIdKnown(normalizedSchemaSaid)) {
    res.status(409).send({
      success: false,
      data: "",
    });
    return;
  }

  await issueCredentialAndGrant(client, qviCredentialId, {
    schemaSaid: normalizedSchemaSaid,
    aid,
    attribute,
  });

  res.status(200).send({
    success: true,
    data: "Credential offered",
  });
}

export async function requestDisclosure(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const client: SignifyClient = req.app.get("signifyClient");
  const { schemaSaid, aid, attributes } = req.body;

  const [apply, sigs] = await client.ipex().apply({
    senderName: ISSUER_NAME,
    recipient: aid,
    schemaSaid,
    attributes,
  });
  await client.ipex().submitApply(ISSUER_NAME, apply, sigs, [aid]);

  res.status(200).send({
    success: true,
    data: "Apply schema successfully",
  });
}

export async function contactCredentials(
  req: Request,
  res: Response
): Promise<void> {
  const client: SignifyClient = req.app.get("signifyClient");
  const { contactId } = req.query;

  const issuer = await client.identifiers().get(ISSUER_NAME);

  const data = await client.credentials().list({
    filter: {
      "-i": issuer.prefix,
      "-a-i": contactId as string,
    },
  });

  res.status(200).send({
    success: true,
    data,
  });
}

export async function revokeCredentialWithNotification(
  client: SignifyClient,
  credentialId: string,
  holder?: string
): Promise<{ alreadyRevoked: boolean }> {
  // Get the credential first
  let credential = await client
    .credentials()
    .get(credentialId)
    .catch((error) => {
      const status = error.message.split(" - ")[1];
      if (/404/gi.test(status)) {
        return null;
      }

      throw error;
    });

  if (!credential) {
    throw new Error(`${CREDENTIAL_NOT_FOUND} ${credentialId}`);
  }

  // Handle already revoked credential
  if (credential.status.s === "1") {
    return { alreadyRevoked: true };
  }

  const holderFromCredential = String(
    (credential as { sad?: { a?: { i?: string } } })?.sad?.a?.i || ""
  ).trim();
  const holderDid = String(holder || holderFromCredential).trim();
  if (!holderDid) {
    throw new Error(
      "holder is required when revocation notification recipient cannot be determined"
    );
  }

  // Proceed with revocation
  await client.credentials().revoke(ISSUER_NAME, credentialId);

  while (credential.status.s !== "1") {
    credential = await client.credentials().get(credentialId);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const datetime = new Date().toISOString().replace("Z", "000+00:00");
  const [grant, gsigs, gend] = await client.ipex().grant({
    senderName: ISSUER_NAME,
    recipient: holderDid,
    acdc: new Serder(credential.sad),
    anc: new Serder(credential.anc),
    iss: new Serder(credential.iss),
    datetime,
    ...buildGrantAttachments(credential),
  });
  const submitGrantOp: Operation = await client
    .ipex()
    .submitGrant(ISSUER_NAME, grant, gsigs, gend, [holderDid]);
  await waitAndGetDoneOp(client, submitGrantOp, OP_TIMEOUT);

  return { alreadyRevoked: false };
}

export async function revokeCredential(
  req: Request,
  res: Response
): Promise<void> {
  const client: SignifyClient = req.app.get("signifyClient");
  const { credentialId, holder } = req.body;

  try {
    const { alreadyRevoked } = await revokeCredentialWithNotification(
      client,
      credentialId,
      holder
    );

    if (alreadyRevoked) {
      res.status(409).send({
        success: false,
        data: CREDENTIAL_REVOKED_ALREADY,
      });
      return;
    }

    res.status(200).send({
      success: true,
      data: "Revoke credential successfully",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith(CREDENTIAL_NOT_FOUND)) {
      res.status(404).send({
        success: false,
        data: message,
      });
      return;
    }

    throw error;
  }
}

export async function deleteRevokedCredentials(
  req: Request,
  res: Response
): Promise<void> {
  const client: SignifyClient = req.app.get("signifyClient");
  const holder = String(req.query.holder || req.body?.holder || "").trim();
  const schemaSaid = String(
    req.query.schemaSaid || req.body?.schemaSaid || ""
  ).trim();

  const issuer = await client.identifiers().get(ISSUER_NAME);
  const filter: Record<string, unknown> = {
    "-i": issuer.prefix,
  };

  if (holder) {
    filter["-a-i"] = holder;
  }

  if (schemaSaid) {
    filter["-s"] = { $eq: schemaSaid };
  }

  const credentialsResponse = await client.credentials().list({
    filter,
  });
  const credentials = getCredentialEntries(credentialsResponse);

  const deletedCredentialIds: string[] = [];
  const alreadyDeletedCredentialIds: string[] = [];
  const skippedNonRevokedCredentialIds: string[] = [];

  for (const credential of credentials) {
    const credentialId = getCredentialId(credential);
    if (!credentialId) {
      continue;
    }

    if (String(credential.status?.s || "") !== "1") {
      skippedNonRevokedCredentialIds.push(credentialId);
      continue;
    }

    await client
      .credentials()
      .delete(credentialId)
      .then(() => {
        deletedCredentialIds.push(credentialId);
      })
      .catch((error) => {
        const status =
          error instanceof Error ? error.message.split(" - ")[1] : "";
        if (/404/gi.test(status || "")) {
          alreadyDeletedCredentialIds.push(credentialId);
          return;
        }
        throw error;
      });
  }

  res.status(200).send({
    success: true,
    data: {
      holder: holder || null,
      schemaSaid: schemaSaid || null,
      deletedCredentialIds,
      alreadyDeletedCredentialIds,
      skippedNonRevokedCredentialIds,
    },
  });
}
