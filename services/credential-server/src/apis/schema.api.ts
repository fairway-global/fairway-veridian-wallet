import { Request, Response } from "express";
import { canonicalSchemaId } from "../consts";
import {
  getSchemaDocument,
  listAvailableSchemas,
} from "../services/dashboardStore";
import { getSignifyClientFromRequest } from "../utils/requestContext";

function normalizeSchemaList(
  value: unknown
): Array<{ id: string; name: string }> {
  const rawItems = Array.isArray(value)
    ? value
    : Array.isArray((value as { schemas?: unknown[] } | null)?.schemas)
      ? ((value as { schemas: unknown[] }).schemas ?? [])
      : Array.isArray((value as { data?: unknown[] } | null)?.data)
        ? ((value as { data: unknown[] }).data ?? [])
        : [];

  return rawItems
    .map((item) => {
      const schema = (item || {}) as Record<string, unknown>;
      const id = canonicalSchemaId(
        String(
          schema.id || schema.said || schema.$id || schema.schemaId || ""
        ).trim()
      );
      const name = String(
        schema.name || schema.title || schema.id || schema.said || schema.$id || ""
      ).trim();

      return { id, name: name || id };
    })
    .filter((schema) => Boolean(schema.id));
}

export async function schemaApi(req: Request, res: Response) {
  const schemaMap = new Map<string, string>();

  try {
    const client = getSignifyClientFromRequest(req);
    const remoteSchemas = normalizeSchemaList(await client.schemas().list());
    remoteSchemas.forEach((schema) => {
      schemaMap.set(schema.id, schema.name);
    });
  } catch {
    // Fall back to the local schema registry when the runtime client is unavailable.
  }

  const localSchemas = await listAvailableSchemas();
  localSchemas.forEach((schema) => {
    if (!schemaMap.has(schema.id)) {
      schemaMap.set(schema.id, schema.name);
    }
  });

  const schemas = Array.from(schemaMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));

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
