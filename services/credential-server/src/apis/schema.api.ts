import { Request, Response } from "express";
import type { SignifyClient } from "signify-ts";
import { canonicalSchemaId } from "../consts";
import {
  getSchemaDocument,
  listAvailableSchemas,
  listTemplates,
} from "../services/dashboardStore";
import {
  assertSchemaReadableForIssuer,
  listVisibleSchemasForIssuer,
  SchemaAccessError,
} from "../services/schemaAccessService";
import { listTemplatesByIssuer } from "../services/tenantStore";
import { getSignifyClientFromRequest } from "../utils/requestContext";

type SchemaSummary = { id: string; name: string };

const SCHEMA_ID_LIKE_PATTERN = /^[A-Za-z0-9_-]{40,}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function isIdLikeSchemaName(name: string, id: string): boolean {
  const normalizedName = String(name || "").trim();
  const normalizedId = canonicalSchemaId(String(id || "").trim());

  return (
    !normalizedName ||
    normalizedName === normalizedId ||
    SCHEMA_ID_LIKE_PATTERN.test(normalizedName)
  );
}

function shouldReplaceSchemaName(
  currentName: string | undefined,
  candidateName: string,
  id: string
): boolean {
  if (!candidateName) {
    return false;
  }

  if (!currentName) {
    return true;
  }

  if (currentName === candidateName) {
    return false;
  }

  return (
    isIdLikeSchemaName(currentName, id) &&
    !isIdLikeSchemaName(candidateName, id)
  );
}

function upsertSchemaName(
  schemaMap: Map<string, string>,
  schema: SchemaSummary
): void {
  const id = canonicalSchemaId(String(schema.id || "").trim());
  if (!id) {
    return;
  }

  const name = String(schema.name || "").trim() || id;
  if (shouldReplaceSchemaName(schemaMap.get(id), name, id)) {
    schemaMap.set(id, name);
  }
}

function normalizeSchemaList(value: unknown): SchemaSummary[] {
  const rawItems = Array.isArray(value)
    ? value
    : Array.isArray((value as { schemas?: unknown[] } | null)?.schemas)
    ? (value as { schemas: unknown[] }).schemas ?? []
    : Array.isArray((value as { data?: unknown[] } | null)?.data)
    ? (value as { data: unknown[] }).data ?? []
    : [];

  return rawItems
    .map((item) => {
      const schema = asRecord(item) || {};
      const nestedSchema = asRecord(schema.schema) || {};
      const id = canonicalSchemaId(
        firstString(
          schema.id,
          schema.said,
          schema.$id,
          schema.schemaId,
          nestedSchema.id,
          nestedSchema.said,
          nestedSchema.$id,
          nestedSchema.schemaId
        )
      );
      const name = firstString(
        schema.name,
        schema.title,
        schema.credentialType,
        nestedSchema.name,
        nestedSchema.title,
        nestedSchema.credentialType,
        schema.id,
        schema.said,
        schema.$id,
        nestedSchema.id,
        nestedSchema.said,
        nestedSchema.$id
      );

      return { id, name: name || id };
    })
    .filter((schema) => Boolean(schema.id));
}

async function resolveRemoteSchemaDetails(
  client: SignifyClient,
  schemas: SchemaSummary[]
): Promise<SchemaSummary[]> {
  const schemasNeedingTitles = schemas.filter((schema) =>
    isIdLikeSchemaName(schema.name, schema.id)
  );

  const resolved = await Promise.all(
    schemasNeedingTitles.map(async (schema) => {
      try {
        const detail = await client.schemas().get(schema.id);
        return normalizeSchemaList([detail])[0] || schema;
      } catch {
        return schema;
      }
    })
  );

  return resolved;
}

async function listTemplateSchemaNames(
  issuerId: string | null
): Promise<SchemaSummary[]> {
  const dashboardTemplates = await listTemplates().catch(() => []);
  const issuerTemplates = issuerId
    ? await listTemplatesByIssuer(issuerId).catch(() => [])
    : [];

  return [...dashboardTemplates, ...issuerTemplates]
    .map((template) => ({
      id: canonicalSchemaId(String(template.schemaId || "").trim()),
      name: String(template.name || "").trim(),
    }))
    .filter((schema) => Boolean(schema.id && schema.name));
}

function getIssuerId(req: Request): string | null {
  const issuerId = String(
    req.authUser?.issuerId ||
      req.issuerRuntime?.issuerId ||
      req.gatewayToken?.issuerId ||
      ""
  ).trim();

  return issuerId || null;
}

export async function schemaApi(req: Request, res: Response) {
  const schemaMap = new Map<string, string>();
  const issuerId = getIssuerId(req);

  try {
    const client = getSignifyClientFromRequest(req);
    const remoteSchemas = normalizeSchemaList(await client.schemas().list());
    remoteSchemas.forEach((schema) => upsertSchemaName(schemaMap, schema));
    const remoteSchemaDetails = await resolveRemoteSchemaDetails(
      client,
      remoteSchemas
    );
    remoteSchemaDetails.forEach((schema) =>
      upsertSchemaName(schemaMap, schema)
    );
  } catch {
    // Fall back to the local schema registry when the runtime client is unavailable.
  }

  const localSchemas = await listAvailableSchemas();
  localSchemas.forEach((schema) => upsertSchemaName(schemaMap, schema));

  const templateSchemas = await listTemplateSchemaNames(issuerId);
  templateSchemas.forEach((schema) => upsertSchemaName(schemaMap, schema));

  const schemaSummaries = Array.from(schemaMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));

  const visibleSchemas = issuerId
    ? await listVisibleSchemasForIssuer(issuerId, schemaSummaries)
    : schemaSummaries.map((schema) => ({
        ...schema,
        isPublic: true,
        ownedByCurrentIssuer: false,
        canManageVisibility: false,
      }));

  const schemas = visibleSchemas.sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  res.status(200).send({
    success: true,
    data: schemas,
  });
}

export async function schemaDetailApi(req: Request, res: Response) {
  const schemaId = canonicalSchemaId(String(req.params.id || "").trim());
  if (!schemaId) {
    res.status(400).send({
      success: false,
      error: "Schema id is required",
    });
    return;
  }

  try {
    await assertSchemaReadableForIssuer(getIssuerId(req), schemaId);
  } catch (error) {
    if (error instanceof SchemaAccessError) {
      res.status(error.statusCode).send({
        success: false,
        error: error.message,
      });
      return;
    }

    res.status(500).send({
      success: false,
      error: "Unable to load schema",
    });
    return;
  }

  try {
    const client = getSignifyClientFromRequest(req);
    const schema = await client.schemas().get(schemaId);
    res.status(200).send(schema);
    return;
  } catch {
    const fallback = await getSchemaDocument(schemaId);
    if (fallback) {
      res.status(200).send(fallback);
      return;
    }
  }

  res.status(404).send({
    success: false,
    error: "Schema not found",
  });
}
