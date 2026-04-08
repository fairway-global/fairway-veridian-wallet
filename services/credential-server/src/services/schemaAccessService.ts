import {
  canonicalSchemaId,
  FAYDA_AUTO_VERIFIED_SCHEMA_SAID,
} from "../consts";
import {
  getSchemaRegistryById,
  listSchemaRegistryByIds,
  upsertSchemaRegistry,
} from "./tenantStore";
import { SchemaRegistryRecord } from "./tenantStore.types";

interface SchemaSummary {
  id: string;
  name: string;
}

export interface SchemaListItem extends SchemaSummary {
  isPublic: boolean;
  ownedByCurrentIssuer: boolean;
  canManageVisibility: boolean;
}

interface SchemaAccessState {
  schemaId: string;
  registry: SchemaRegistryRecord | null;
  isPublic: boolean;
  ownedByCurrentIssuer: boolean;
  canManageVisibility: boolean;
  accessible: boolean;
}

export class SchemaAccessError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = "SchemaAccessError";
    this.statusCode = statusCode;
  }
}

function normalizeIssuerId(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function buildSchemaAccessState(input: {
  issuerId: string | null;
  schemaId: string;
  registry: SchemaRegistryRecord | null;
}): SchemaAccessState {
  const { issuerId, schemaId, registry } = input;
  const ownedByCurrentIssuer = Boolean(
    issuerId && registry?.ownerIssuerId === issuerId
  );
  const isPublic = Boolean(
    registry?.isPublic || schemaId === FAYDA_AUTO_VERIFIED_SCHEMA_SAID
  );
  const canManageVisibility = Boolean(issuerId && ownedByCurrentIssuer);

  return {
    schemaId,
    registry,
    isPublic,
    ownedByCurrentIssuer,
    canManageVisibility,
    accessible: Boolean(isPublic || ownedByCurrentIssuer),
  };
}

async function getSchemaAccessStateForIssuer(
  issuerIdInput: string | null | undefined,
  schemaId: string
): Promise<SchemaAccessState> {
  const issuerId = normalizeIssuerId(issuerIdInput);
  const normalizedSchemaId = canonicalSchemaId(String(schemaId || "").trim());
  if (!normalizedSchemaId) {
    throw new SchemaAccessError("Schema id is required", 400);
  }

  const registry = await getSchemaRegistryById(normalizedSchemaId);

  return buildSchemaAccessState({
    issuerId,
    schemaId: normalizedSchemaId,
    registry,
  });
}

export async function listVisibleSchemasForIssuer(
  issuerIdInput: string | null | undefined,
  schemas: SchemaSummary[]
): Promise<SchemaListItem[]> {
  const issuerId = normalizeIssuerId(issuerIdInput);
  const normalizedSchemas = Array.from(
    new Map(
      (Array.isArray(schemas) ? schemas : [])
        .map((schema) => ({
          id: canonicalSchemaId(String(schema?.id || "").trim()),
          name: String(schema?.name || "").trim(),
        }))
        .filter((schema) => Boolean(schema.id))
        .map((schema) => [
          schema.id,
          {
            id: schema.id,
            name: schema.name || schema.id,
          },
        ])
    ).values()
  );

  if (!normalizedSchemas.length) {
    return [];
  }

  const registryRows = await listSchemaRegistryByIds(
    normalizedSchemas.map((schema) => schema.id)
  );

  const registryById = new Map(
    registryRows.map((registry) => [registry.schemaId, registry])
  );

  return normalizedSchemas
    .map((schema) => {
      const accessState = buildSchemaAccessState({
        issuerId,
        schemaId: schema.id,
        registry: registryById.get(schema.id) || null,
      });

      if (!accessState.accessible) {
        return null;
      }

      return {
        id: schema.id,
        name: schema.name,
        isPublic: accessState.isPublic,
        ownedByCurrentIssuer: accessState.ownedByCurrentIssuer,
        canManageVisibility: accessState.canManageVisibility,
      };
    })
    .filter((schema): schema is SchemaListItem => Boolean(schema));
}

export async function assertSchemaReadableForIssuer(
  issuerIdInput: string | null | undefined,
  schemaId: string
): Promise<void> {
  const accessState = await getSchemaAccessStateForIssuer(issuerIdInput, schemaId);
  if (!accessState.accessible) {
    throw new SchemaAccessError("Schema not found", 404);
  }
}

export async function ensureSchemaUsableForIssuer(
  issuerIdInput: string | null | undefined,
  schemaId: string
): Promise<void> {
  const accessState = await getSchemaAccessStateForIssuer(issuerIdInput, schemaId);
  if (!accessState.accessible) {
    throw new SchemaAccessError(
      "This schema is private to another issuer and cannot be used here",
      403
    );
  }
}

export async function registerSchemaForIssuer(input: {
  issuerId: string;
  schemaId: string;
  isPublic: boolean;
}): Promise<SchemaRegistryRecord> {
  const issuerId = normalizeIssuerId(input.issuerId);
  const schemaId = canonicalSchemaId(String(input.schemaId || "").trim());
  if (!issuerId) {
    throw new SchemaAccessError("Unauthorized", 401);
  }
  if (!schemaId) {
    throw new SchemaAccessError("Schema id is required", 400);
  }

  return upsertSchemaRegistry({
    schemaId,
    ownerIssuerId: issuerId,
    isPublic: Boolean(input.isPublic),
  });
}

export async function syncSchemaVisibilityForIssuer(input: {
  issuerId: string;
  schemaId: string;
  isPublic: boolean;
}): Promise<SchemaRegistryRecord | null> {
  const issuerId = normalizeIssuerId(input.issuerId);
  const schemaId = canonicalSchemaId(String(input.schemaId || "").trim());
  if (!issuerId) {
    throw new SchemaAccessError("Unauthorized", 401);
  }
  if (!schemaId) {
    throw new SchemaAccessError("Schema id is required", 400);
  }

  const accessState = await getSchemaAccessStateForIssuer(issuerId, schemaId);
  if (!accessState.accessible) {
    throw new SchemaAccessError(
      "This schema is private to another issuer and cannot be used here",
      403
    );
  }

  if (accessState.ownedByCurrentIssuer || accessState.canManageVisibility) {
    return upsertSchemaRegistry({
      schemaId,
      ownerIssuerId: issuerId,
      isPublic: Boolean(input.isPublic),
    });
  }

  if (accessState.isPublic !== Boolean(input.isPublic)) {
    throw new SchemaAccessError(
      "Only the owning issuer can change this schema's visibility",
      403
    );
  }

  return accessState.registry;
}
