import { Request, Response } from "express";
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listIssuedCredentialRecords,
  listTemplates,
  updateTemplate,
} from "../services/dashboardStore";
import { TemplateAttribute } from "../services/dashboardStore.types";
import { sendError, sendSuccess } from "../utils/apiResponse";

interface UpsertTemplateRequestBody {
  name?: string;
  schemaId?: string;
  attributes?: TemplateAttribute[];
}

export async function listTemplatesApi(_: Request, res: Response): Promise<void> {
  // OpenAPI: GET /api/templates
  const templates = await listTemplates();
  sendSuccess(res, templates);
}

export async function getTemplateByIdApi(
  req: Request,
  res: Response
): Promise<void> {
  // OpenAPI: GET /api/templates/:id
  const templateId = String(req.params.id || "").trim();
  if (!templateId) {
    sendError(res, 400, "Template id is required");
    return;
  }

  const template = await getTemplateById(templateId);
  if (!template) {
    sendError(res, 404, "Template not found");
    return;
  }

  const issuedCredentials = (await listIssuedCredentialRecords()).filter(
    (credential) => credential.templateId === templateId
  );

  sendSuccess(res, {
    ...template,
    issuedCredentials,
  });
}

export async function createTemplateApi(
  req: Request<{}, {}, UpsertTemplateRequestBody>,
  res: Response
): Promise<void> {
  // OpenAPI: POST /api/templates
  try {
    const template = await createTemplate({
      name: String(req.body.name || "").trim(),
      schemaId: String(req.body.schemaId || "").trim(),
      attributes: Array.isArray(req.body.attributes) ? req.body.attributes : [],
    });
    sendSuccess(res, template, 201);
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : "Invalid data");
  }
}

export async function updateTemplateApi(
  req: Request<{ id: string }, {}, UpsertTemplateRequestBody>,
  res: Response
): Promise<void> {
  // OpenAPI: PUT /api/templates/:id
  const templateId = String(req.params.id || "").trim();
  if (!templateId) {
    sendError(res, 400, "Template id is required");
    return;
  }

  try {
    const updatedTemplate = await updateTemplate(templateId, {
      name: String(req.body.name || "").trim(),
      schemaId: String(req.body.schemaId || "").trim(),
      attributes: Array.isArray(req.body.attributes) ? req.body.attributes : [],
    });

    if (!updatedTemplate) {
      sendError(res, 404, "Template not found");
      return;
    }

    sendSuccess(res, updatedTemplate);
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : "Invalid data");
  }
}

export async function deleteTemplateApi(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  // OpenAPI: DELETE /api/templates/:id
  const templateId = String(req.params.id || "").trim();
  if (!templateId) {
    sendError(res, 400, "Template id is required");
    return;
  }

  const deleted = await deleteTemplate(templateId);
  if (!deleted) {
    sendError(res, 404, "Template not found");
    return;
  }

  sendSuccess(res, { id: templateId, deleted: true });
}
