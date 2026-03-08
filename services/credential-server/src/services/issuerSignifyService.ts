import { SignifyClient, Tier } from "signify-ts";
import { config } from "../config";
import { ACDC_SCHEMAS_ID, QVI_NAME } from "../consts";
import { EndRole } from "../server.types";
import {
  createQVICredential,
  getEndRoles,
  getRegistry,
  resolveOobi,
  waitAndGetDoneOp,
  REGISTRIES_NOT_FOUND,
} from "../utils/utils";
import { decryptSecret } from "./cryptoService";
import {
  getIssuerById,
  getIssuerSignifyAccountByIssuerId,
  updateIssuerSignifyRuntime,
} from "./tenantStore";

export interface IssuerRuntime {
  issuerId: string;
  issuerCode: string;
  issuerName: string;
  aidAlias: string;
  aidPrefix: string;
  registryRegk: string;
  qviCredentialId: string;
  client: SignifyClient;
}

async function buildSignifyClient(bran: string): Promise<SignifyClient> {
  const client = new SignifyClient(
    config.keria.url,
    bran,
    Tier.low,
    config.keria.bootUrl
  );

  try {
    await client.connect();
  } catch {
    await client.boot();
    await client.connect();
  }

  await Promise.allSettled(
    ACDC_SCHEMAS_ID.map((schemaId) =>
      resolveOobi(client, `${config.oobiEndpoint}/oobi/${schemaId}`)
    )
  );

  return client;
}

async function ensureIdentifierExists(
  client: SignifyClient,
  aidName: string
): Promise<void> {
  try {
    await client.identifiers().get(aidName);
  } catch (error) {
    const message = String((error as Error)?.message || "");
    if (!/404/gi.test(message)) {
      throw error;
    }

    const result = await client.identifiers().create(aidName);
    await waitAndGetDoneOp(client, await result.op());
    await client.identifiers().get(aidName);
  }
}

async function ensureEndRoles(
  client: SignifyClient,
  aidName: string
): Promise<void> {
  const roles = await getEndRoles(client, aidName);
  const hasAgentRole = roles.some((role: { role?: string }) => {
    return String(role.role || "").toLowerCase() === EndRole.AGENT;
  });

  if (!hasAgentRole) {
    await client.identifiers().addEndRole(aidName, EndRole.AGENT, client.agent!.pre);
  }

  const hasIndexerRole = roles.some((role: { role?: string }) => {
    return String(role.role || "").toLowerCase() === EndRole.INDEXER;
  });
  if (!hasIndexerRole) {
    const identifier = await client.identifiers().get(aidName);
    const result = await client
      .identifiers()
      .addEndRole(aidName, EndRole.INDEXER, identifier.prefix);
    await waitAndGetDoneOp(client, await result.op());
    const locRes = await client.identifiers().addLocScheme(aidName, {
      url: config.oobiEndpoint,
      scheme: new URL(config.oobiEndpoint).protocol.replace(":", ""),
    });
    await waitAndGetDoneOp(client, await locRes.op());
  }
}

async function ensureRegistryExists(
  client: SignifyClient,
  aidName: string
): Promise<void> {
  try {
    await getRegistry(client, aidName);
  } catch (error) {
    const message = String((error as Error)?.message || "");
    if (!message.includes(REGISTRIES_NOT_FOUND)) {
      throw error;
    }
    const result = await client
      .registries()
      .create({ name: aidName, registryName: "vLEI" });
    await waitAndGetDoneOp(client, await result.op());
  }
}

export class IssuerSignifyService {
  private runtimeByIssuerId = new Map<string, IssuerRuntime>();

  constructor(private globalQviClient: SignifyClient) {}

  async getRuntimeByIssuerId(issuerId: string): Promise<IssuerRuntime> {
    const cached = this.runtimeByIssuerId.get(issuerId);
    if (cached) {
      return cached;
    }

    const issuer = await getIssuerById(issuerId);
    if (!issuer) {
      throw new Error("Issuer not found");
    }

    const account = await getIssuerSignifyAccountByIssuerId(issuerId);
    if (!account) {
      throw new Error("Issuer Signify account is not configured");
    }

    const bran = decryptSecret(account.branEncrypted);
    const client = await buildSignifyClient(bran);
    const aidAlias = String(account.aidAlias || "").trim();
    if (!aidAlias) {
      throw new Error("Issuer Signify alias is missing");
    }

    await ensureIdentifierExists(client, aidAlias);
    await ensureEndRoles(client, aidAlias);
    await ensureRegistryExists(client, aidAlias);

    const identifier = await client.identifiers().get(aidAlias);
    const registryRegk =
      account.registryRegk || (await getRegistry(client, aidAlias));
    let qviCredentialId = account.qviCredentialId || "";
    if (!qviCredentialId) {
      const qviRegistry = await getRegistry(this.globalQviClient, QVI_NAME);
      qviCredentialId = await createQVICredential(
        client,
        this.globalQviClient,
        qviRegistry,
        aidAlias
      );
    }

    await updateIssuerSignifyRuntime(issuerId, {
      aidPrefix: identifier.prefix,
      registryRegk,
      qviCredentialId,
      initialized: true,
    });

    const runtime: IssuerRuntime = {
      issuerId: issuer.id,
      issuerCode: issuer.code,
      issuerName: issuer.name,
      aidAlias,
      aidPrefix: identifier.prefix,
      registryRegk,
      qviCredentialId,
      client,
    };
    this.runtimeByIssuerId.set(issuerId, runtime);
    return runtime;
  }

  clearCache(): void {
    this.runtimeByIssuerId.clear();
  }
}
