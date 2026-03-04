import { Ilks } from "signify-ts";
import { AgentServicesProps } from "../agent.types";
import { AgentService } from "./agentService";
import { CredentialMetadataRecordProps } from "../records/credentialMetadataRecord.types";
import {
  CredentialShortDetails,
  ACDCDetails,
  CredentialStatus,
} from "./credentialService.types";
import { CredentialMetadataRecord } from "../records/credentialMetadataRecord";
import { getCredentialShortDetails, OnlineOnly } from "./utils";
import {
  CredentialStorage,
  IdentifierStorage,
  NotificationStorage,
} from "../records";
import { KeriaContactKeyPrefix } from "./connectionService.types";
import {
  AcdcStateChangedEvent,
  CredentialRemovedEvent,
  EventTypes,
} from "../event.types";
import { IdentifierType } from "./identifier.types";

class CredentialService extends AgentService {
  static readonly CREDENTIAL_MISSING_METADATA_ERROR_MSG =
    "Credential metadata missing for stored credential";
  static readonly CREDENTIAL_NOT_ARCHIVED = "Credential was not archived";
  static readonly CREDENTIAL_NOT_FOUND =
    "Credential with given SAID not found on KERIA";
  private static readonly CREDENTIAL_CLOUD_RETRY_ATTEMPTS = 4;
  private static readonly CREDENTIAL_CLOUD_RETRY_DELAY_MS = 250;
  private static readonly CREDENTIAL_TYPE_ID_LIKE_PATTERN =
    /^[A-Za-z0-9_-]{40,}$/;

  private static isMissingCredentialCloudError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message || "";
    const status = message.split(" - ")[1] || "";

    if (/404/gi.test(status)) {
      return true;
    }

    // Some KERIA versions return 500 instead of 404 for missing /credentials/{said}.
    return (
      /500/gi.test(status) &&
      /HTTP GET \/credentials\//i.test(message) &&
      /"title"\s*:\s*"500 Internal Server Error"/i.test(message)
    );
  }

  protected readonly credentialStorage: CredentialStorage;
  protected readonly notificationStorage!: NotificationStorage;
  protected readonly identifierStorage!: IdentifierStorage;

  constructor(
    agentServiceProps: AgentServicesProps,
    credentialStorage: CredentialStorage,
    notificationStorage: NotificationStorage,
    identifierStorage: IdentifierStorage
  ) {
    super(agentServiceProps);
    this.credentialStorage = credentialStorage;
    this.notificationStorage = notificationStorage;
    this.identifierStorage = identifierStorage;
  }

  onAcdcStateChanged(callback: (event: AcdcStateChangedEvent) => void) {
    this.props.eventEmitter.on(EventTypes.AcdcStateChanged, callback);
  }

  onCredentialRemoved() {
    this.props.eventEmitter.on(
      EventTypes.CredentialRemovedEvent,
      (data: CredentialRemovedEvent) =>
        this.deleteCredential(data.payload.credentialId)
    );
  }

  async getCredentials(
    isGetArchive = false
  ): Promise<CredentialShortDetails[]> {
    const listMetadatas = await this.credentialStorage.getAllCredentialMetadata(
      isGetArchive
    );

    await this.resolveCredentialTypeFromSchema(listMetadatas);

    return listMetadatas.map((element: CredentialMetadataRecord) =>
      getCredentialShortDetails(element)
    );
  }

  async getCredentialShortDetailsById(
    id: string
  ): Promise<CredentialShortDetails> {
    return getCredentialShortDetails(await this.getMetadataById(id));
  }

  @OnlineOnly
  async getCredentialDetailsById(id: string): Promise<ACDCDetails> {
    const metadata = await this.getMetadataById(id);
    const acdc = await this.getCredentialFromCloudWithRetry(metadata.id);

    if (!acdc) {
      // Pending credentials can be briefly unavailable from cloud right after admit.
      if (metadata.status === CredentialStatus.PENDING) {
        return this.buildFallbackDetails(metadata);
      }

      const grantHistoryFallback =
        await this.buildFallbackDetailsFromGrantHistory(metadata);
      if (grantHistoryFallback) {
        return grantHistoryFallback;
      }

      throw new Error(CredentialService.CREDENTIAL_NOT_FOUND);
    }

    const credentialShortDetails = getCredentialShortDetails(metadata);
    const statusDate = acdc.status?.dt || metadata.issuanceDate;
    return {
      id: credentialShortDetails.id,
      schema: credentialShortDetails.schema,
      status: credentialShortDetails.status,
      identifierId: credentialShortDetails.identifierId,
      identifierType: credentialShortDetails.identifierType,
      connectionId: credentialShortDetails.connectionId,
      i: acdc.sad.i,
      a: acdc.sad.a,
      s: {
        title: acdc.schema?.title || metadata.credentialType || metadata.schema,
        description: acdc.schema?.description || "",
        version: acdc.schema?.version || "",
      },
      lastStatus: {
        s: acdc.status.s,
        dt: new Date(statusDate).toISOString(),
      },
    };
  }

  async createMetadata(data: CredentialMetadataRecordProps): Promise<void> {
    const metadataRecord = new CredentialMetadataRecord(data);
    await this.credentialStorage.saveCredentialMetadataRecord(metadataRecord);
  }

  async archiveCredential(id: string): Promise<void> {
    await this.credentialStorage.updateCredentialMetadata(id, {
      isArchived: true,
    });
  }

  async deleteStaleLocalCredential(id: string): Promise<void> {
    await this.credentialStorage.deleteCredentialMetadata(id);
  }

  async deleteCredential(id: string): Promise<void> {
    await this.props.signifyClient
      .credentials()
      .delete(id)
      .catch(async (error) => {
        const status = error.message.split(" - ")[1];
        if (/404/gi.test(status)) {
          return await this.credentialStorage.deleteCredentialMetadata(id);
        } else {
          throw error;
        }
      });

    await this.credentialStorage.deleteCredentialMetadata(id);
  }

  async markCredentialPendingDeletion(id: string): Promise<void> {
    const metadata = await this.getMetadataById(id);
    this.validArchivedCredential(metadata);

    await this.credentialStorage.updateCredentialMetadata(id, {
      pendingDeletion: true,
    });

    this.props.eventEmitter.emit<CredentialRemovedEvent>({
      type: EventTypes.CredentialRemovedEvent,
      payload: {
        credentialId: id,
      },
    });
  }

  async removeCredentialsPendingDeletion(): Promise<void> {
    const pendingCredentialDeletions =
      await this.credentialStorage.getCredentialsPendingDeletion();

    for (const credential of pendingCredentialDeletions) {
      await this.deleteCredential(credential.id);
    }
  }

  async restoreCredential(id: string): Promise<void> {
    const metadata = await this.getMetadataById(id);
    this.validArchivedCredential(metadata);
    await this.credentialStorage.updateCredentialMetadata(id, {
      isArchived: false,
    });
  }

  private validArchivedCredential(metadata: CredentialMetadataRecord): void {
    if (!metadata.isArchived) {
      throw new Error(
        `${CredentialService.CREDENTIAL_NOT_ARCHIVED} ${metadata.id}`
      );
    }
  }

  private async getMetadataById(id: string): Promise<CredentialMetadataRecord> {
    const metadata = await this.credentialStorage.getCredentialMetadata(id);
    if (!metadata) {
      throw new Error(CredentialService.CREDENTIAL_MISSING_METADATA_ERROR_MSG);
    }
    return metadata;
  }

  private async getCredentialFromCloudWithRetry(
    credentialId: string
  ): Promise<any | undefined> {
    for (
      let attempt = 0;
      attempt < CredentialService.CREDENTIAL_CLOUD_RETRY_ATTEMPTS;
      attempt += 1
    ) {
      let credential;
      try {
        credential = await this.props.signifyClient
          .credentials()
          .get(credentialId);
      } catch (error) {
        if (CredentialService.isMissingCredentialCloudError(error)) {
          credential = undefined;
        } else {
          throw error;
        }
      }

      if (credential) {
        return credential;
      }

      if (attempt < CredentialService.CREDENTIAL_CLOUD_RETRY_ATTEMPTS - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, CredentialService.CREDENTIAL_CLOUD_RETRY_DELAY_MS)
        );
      }
    }

    return undefined;
  }

  private shouldResolveCredentialType(metadata: CredentialMetadataRecord): boolean {
    const credentialType = (metadata.credentialType || "").trim();
    const schemaSaid = (metadata.schema || "").trim();

    if (!credentialType) {
      return true;
    }

    if (schemaSaid && credentialType === schemaSaid) {
      return true;
    }

    return CredentialService.CREDENTIAL_TYPE_ID_LIKE_PATTERN.test(
      credentialType
    );
  }

  private async resolveSchemaTitle(schemaSaid: string): Promise<string | undefined> {
    try {
      const schema = await this.props.signifyClient.schemas().get(schemaSaid);
      const title =
        schema && typeof schema.title === "string" ? schema.title.trim() : "";
      return title || undefined;
    } catch {
      return undefined;
    }
  }

  private async resolveCredentialTypeFromSchema(
    metadatas: CredentialMetadataRecord[]
  ): Promise<void> {
    const schemaTitleCache = new Map<string, string | undefined>();

    for (const metadata of metadatas) {
      if (!this.shouldResolveCredentialType(metadata)) {
        continue;
      }

      const schemaSaid = (metadata.schema || "").trim();
      if (!schemaSaid) {
        continue;
      }

      if (!schemaTitleCache.has(schemaSaid)) {
        schemaTitleCache.set(
          schemaSaid,
          await this.resolveSchemaTitle(schemaSaid)
        );
      }

      let resolvedTitle = schemaTitleCache.get(schemaSaid);
      if (!resolvedTitle) {
        try {
          const cloudCredential = await this.getCredentialFromCloudWithRetry(
            metadata.id
          );
          const cloudSchemaTitle =
            typeof cloudCredential?.schema?.title === "string"
              ? cloudCredential.schema.title.trim()
              : "";
          resolvedTitle = cloudSchemaTitle || undefined;
          if (resolvedTitle) {
            schemaTitleCache.set(schemaSaid, resolvedTitle);
          }
        } catch {
          resolvedTitle = undefined;
        }
      }

      if (!resolvedTitle || resolvedTitle === metadata.credentialType) {
        continue;
      }

      metadata.credentialType = resolvedTitle;
      await this.credentialStorage.updateCredentialMetadata(metadata.id, {
        credentialType: resolvedTitle,
      });
    }
  }

  private buildFallbackDetails(metadata: CredentialMetadataRecord): ACDCDetails {
    const issuedAt = Number.isNaN(Date.parse(metadata.issuanceDate))
      ? new Date().toISOString()
      : new Date(metadata.issuanceDate).toISOString();

    return {
      id: metadata.id,
      schema: metadata.schema,
      status: metadata.status,
      identifierId: metadata.identifierId,
      identifierType: metadata.identifierType,
      connectionId: metadata.connectionId,
      i: metadata.connectionId,
      a: {
        i: metadata.identifierId,
        dt: issuedAt,
      },
      s: {
        title: metadata.credentialType || metadata.schema,
        description: "",
        version: "",
      },
      lastStatus: {
        s: metadata.status === CredentialStatus.REVOKED ? "1" : "0",
        dt: issuedAt,
      },
    };
  }

  private async buildFallbackDetailsFromGrantHistory(
    metadata: CredentialMetadataRecord
  ): Promise<ACDCDetails | undefined> {
    if (!metadata.connectionId) {
      return undefined;
    }

    let contact;
    try {
      contact = await this.props.signifyClient.contacts().get(metadata.connectionId);
    } catch {
      contact = undefined;
    }

    if (!contact || typeof contact !== "object") {
      return undefined;
    }

    const ipexHistoryEntries = Object.entries(contact as Record<string, unknown>)
      .filter(
        ([key, value]) =>
          key.startsWith(KeriaContactKeyPrefix.HISTORY_IPEX) &&
          typeof value === "string"
      )
      .map(([, value]) => value as string);

    for (const historyEntry of ipexHistoryEntries) {
      let exchangeId = "";
      try {
        const parsed = JSON.parse(historyEntry) as { id?: unknown };
        exchangeId =
          typeof parsed.id === "string" ? parsed.id.trim() : "";
      } catch {
        continue;
      }

      if (!exchangeId) {
        continue;
      }

      let exchange;
      try {
        exchange = await this.props.signifyClient.exchanges().get(exchangeId);
      } catch {
        exchange = undefined;
      }

      if (!exchange || exchange.exn?.r !== "/ipex/grant") {
        continue;
      }

      const grantAcdc = exchange.exn?.e?.acdc;
      if (!grantAcdc || grantAcdc.d !== metadata.id) {
        continue;
      }

      const grantAttributes =
        grantAcdc.a && typeof grantAcdc.a === "object"
          ? (grantAcdc.a as Record<string, unknown>)
          : {};
      const rawStatusDate =
        typeof grantAttributes.dt === "string"
          ? grantAttributes.dt
          : metadata.issuanceDate;
      const statusDate = Number.isNaN(Date.parse(rawStatusDate))
        ? new Date().toISOString()
        : new Date(rawStatusDate).toISOString();
      const schemaSaid =
        typeof grantAcdc.s === "string" && grantAcdc.s
          ? grantAcdc.s
          : metadata.schema;

      let schema;
      try {
        schema = await this.props.signifyClient.schemas().get(schemaSaid);
      } catch {
        schema = undefined;
      }

      return {
        id: metadata.id,
        schema: schemaSaid,
        status: metadata.status,
        identifierId: metadata.identifierId,
        identifierType: metadata.identifierType,
        connectionId: metadata.connectionId,
        i:
          typeof grantAcdc.i === "string" && grantAcdc.i
            ? grantAcdc.i
            : metadata.connectionId,
        a: {
          ...grantAttributes,
          i:
            typeof grantAttributes.i === "string" && grantAttributes.i
              ? grantAttributes.i
              : metadata.identifierId,
          dt: statusDate,
        },
        s: {
          title: schema?.title || metadata.credentialType || schemaSaid,
          description: schema?.description || "",
          version: schema?.version || "",
        },
        lastStatus: {
          s: metadata.status === CredentialStatus.REVOKED ? "1" : "0",
          dt: statusDate,
        },
      };
    }

    return undefined;
  }

  async syncKeriaCredentials(): Promise<void> {
    const cloudCredentials: any[] = [];
    let returned = -1;
    let iteration = 0;

    while (returned !== 0) {
      const result = await this.props.signifyClient.credentials().list({
        skip: iteration * 24,
        limit: 24 + iteration * 24,
      });
      cloudCredentials.push(...result);

      returned = result.length;
      iteration += 1;
    }

    const localCredentials =
      await this.credentialStorage.getAllCredentialMetadata();

    const unSyncedData = cloudCredentials.filter(
      (credential: any) =>
        !localCredentials.find((item) => credential.sad.d === item.id)
    );

    for (const credential of unSyncedData) {
      const hab = await this.props.signifyClient
        .identifiers()
        .get(credential.sad.a.i);
      const telStatus = (
        await this.props.signifyClient
          .credentials()
          .state(credential.sad.ri, credential.sad.d)
      ).et;

      const metadata = {
        id: credential.sad.d,
        isArchived: false,
        issuanceDate: new Date(credential.sad.a.dt).toISOString(),
        credentialType: credential.schema.title,
        status:
          telStatus === Ilks.iss
            ? CredentialStatus.CONFIRMED
            : CredentialStatus.REVOKED,
        connectionId: credential.sad.i,
        schema: credential.schema.$id,
        identifierId: credential.sad.a.i,
        identifierType: hab.group
          ? IdentifierType.Group
          : IdentifierType.Individual,
        createdAt: new Date(credential.sad.a.dt),
      };

      await this.createMetadata(metadata);
    }
  }

  async markAcdc(
    credentialId: string,
    status: CredentialStatus.CONFIRMED | CredentialStatus.REVOKED
  ): Promise<void> {
    const metadata = await this.credentialStorage.getCredentialMetadata(
      credentialId
    );
    if (!metadata) {
      throw new Error(CredentialService.CREDENTIAL_MISSING_METADATA_ERROR_MSG);
    }

    metadata.status = status;
    await this.credentialStorage.updateCredentialMetadata(
      metadata.id,
      metadata
    );

    this.props.eventEmitter.emit<AcdcStateChangedEvent>({
      type: EventTypes.AcdcStateChanged,
      payload: {
        status,
        credential: getCredentialShortDetails(metadata),
      },
    });
  }
}

export { CredentialService };
