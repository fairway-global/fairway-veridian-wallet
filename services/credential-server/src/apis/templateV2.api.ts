import { Request, Response } from "express";
import { getSignifyClientFromRequest } from "../utils/requestContext";
import {
  createTemplateForIssuer,
  deleteTemplateForIssuer,
  getTemplateByIdForIssuer,
  listIssuedCredentialsByIssuer,
  listTemplatesByIssuer,
  updateTemplateForIssuer,
} from "../services/tenantStore";
import { TemplateAttribute } from "../services/dashboardStore.types";
import { resolveTemplateSchemaForPublication } from "../services/templateSchemaService";
import { SchemaAccessError } from "../services/schemaAccessService";
import { sendError, sendSuccess } from "../utils/apiResponse";

interface UpsertTemplateRequestBody {
  name?: string;
  schemaId?: string;
  attributes?: TemplateAttribute[];
  autoIssue?: boolean;
  schemaPublic?: boolean;
}

function getIssuerId(req: Request): string {
  return String(req.authUser?.issuerId || "").trim();
}

function normalizeAttributes(value: unknown): TemplateAttribute[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item as Partial<TemplateAttribute>)
    .map((item) => ({
      name: String(item.name || "").trim(),
      type: String(item.type || "string") as TemplateAttribute["type"],
      required: Boolean(item.required),
    }))
    .filter((item) => item.name);
}

function validateTemplateInput(
  body: UpsertTemplateRequestBody,
  options?: { requireSchemaId?: boolean }
): string | null {
  const name = String(body.name || "").trim();
  const schemaId = String(body.schemaId || "").trim();
  const requireSchemaId = options?.requireSchemaId ?? true;
  if (!name) {
    return "Template name is required";
  }
  if (requireSchemaId && !schemaId) {
    return "Template schemaId is required";
  }
  if (
    body.autoIssue !== undefined &&
    typeof body.autoIssue !== "boolean"
  ) {
    return "Template autoIssue must be a boolean";
  }
  if (
    body.schemaPublic !== undefined &&
    typeof body.schemaPublic !== "boolean"
  ) {
    return "Template schemaPublic must be a boolean";
  }
  return null;
}

function normalizeAutoIssue(value: unknown): boolean {
  return Boolean(value);
}

export async function listTemplatesApiV2(
  req: Request,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const templates = await listTemplatesByIssuer(issuerId);
  sendSuccess(res, templates);
}

export async function getTemplateByIdApiV2(
  req: Request,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const templateId = String(req.params.id || "").trim();
  if (!templateId) {
    sendError(res, 400, "Template id is required");
    return;
  }

  const template = await getTemplateByIdForIssuer(issuerId, templateId);
  if (!template) {
    sendError(res, 404, "Template not found");
    return;
  }

  const issuedCredentials = (await listIssuedCredentialsByIssuer(issuerId)).filter(
    (credential) => credential.templateId === templateId
  );

  sendSuccess(res, {
    ...template,
    issuedCredentials,
  });
}

export async function createTemplateApiV2(
  req: Request<{}, {}, UpsertTemplateRequestBody>,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const validationError = validateTemplateInput(req.body, {
    requireSchemaId: false,
  });
  if (validationError) {
    sendError(res, 400, validationError);
    return;
  }

  const name = String(req.body.name || "").trim();
  const normalizedAttributes = normalizeAttributes(req.body.attributes);

  try {
    const client = getSignifyClientFromRequest(req);
    const resolvedSchema = await resolveTemplateSchemaForPublication({
      client,
      issuerId,
      name,
      schemaId: String(req.body.schemaId || "").trim(),
      attributes: normalizedAttributes,
      schemaPublic:
        req.body.schemaPublic === undefined
          ? undefined
          : Boolean(req.body.schemaPublic),
    });

    const template = await createTemplateForIssuer({
      issuerId,
      name,
      schemaId: resolvedSchema.schemaId,
      attributes: resolvedSchema.attributes,
      autoIssue: normalizeAutoIssue(req.body.autoIssue),
    });
    sendSuccess(res, template, 201);
  } catch (error) {
    sendError(
      res,
      error instanceof SchemaAccessError ? error.statusCode : 400,
      error instanceof Error ? error.message : "Invalid data"
    );
  }
}

export async function updateTemplateApiV2(
  req: Request<{ id: string }, {}, UpsertTemplateRequestBody>,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const templateId = String(req.params.id || "").trim();
  if (!templateId) {
    sendError(res, 400, "Template id is required");
    return;
  }

  const currentTemplate = await getTemplateByIdForIssuer(issuerId, templateId);
  if (!currentTemplate) {
    sendError(res, 404, "Template not found");
    return;
  }

  const validationError = validateTemplateInput(req.body);
  if (validationError) {
    sendError(res, 400, validationError);
    return;
  }

  try {
    const client = getSignifyClientFromRequest(req);
    const resolvedSchema = await resolveTemplateSchemaForPublication({
      client,
      issuerId,
      name: String(req.body.name || "").trim(),
      schemaId: String(req.body.schemaId || "").trim(),
      attributes: normalizeAttributes(req.body.attributes),
      schemaPublic:
        req.body.schemaPublic === undefined
          ? undefined
          : Boolean(req.body.schemaPublic),
    });

    const updated = await updateTemplateForIssuer(issuerId, templateId, {
      name: String(req.body.name || "").trim(),
      schemaId: resolvedSchema.schemaId,
      attributes: resolvedSchema.attributes,
      autoIssue:
        req.body.autoIssue === undefined
          ? Boolean(currentTemplate.autoIssue)
          : normalizeAutoIssue(req.body.autoIssue),
    });
    if (!updated) {
      sendError(res, 404, "Template not found");
      return;
    }

    sendSuccess(res, updated);
  } catch (error) {
    sendError(
      res,
      error instanceof SchemaAccessError ? error.statusCode : 400,
      error instanceof Error ? error.message : "Invalid data"
    );
  }
}

export async function deleteTemplateApiV2(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const templateId = String(req.params.id || "").trim();
  if (!templateId) {
    sendError(res, 400, "Template id is required");
    return;
  }

  const deleted = await deleteTemplateForIssuer(issuerId, templateId);
  if (!deleted) {
    sendError(res, 404, "Template not found");
    return;
  }
  sendSuccess(res, {
    id: templateId,
    deleted: true,
  });
}
