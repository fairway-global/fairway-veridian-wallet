import { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/apiResponse";
import {
  createAccountChangeRequest,
  getIssuerById,
  getIssuerSignifyAccountByIssuerId,
  getIssuerUserById,
  listAccountChangeRequests,
} from "../services/tenantStore";

type RequestField = "issuer_name" | "email";

function normalizeRequestField(value: unknown): RequestField | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "issuer_name" || normalized === "email") {
    return normalized;
  }
  return null;
}

export async function accountProfileApi(
  req: Request,
  res: Response
): Promise<void> {
  const userId = String(req.authUser?.id || "").trim();
  const issuerId = String(req.authUser?.issuerId || "").trim();
  if (!userId || !issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const [user, issuer, account] = await Promise.all([
    getIssuerUserById(issuerId, userId),
    getIssuerById(issuerId),
    getIssuerSignifyAccountByIssuerId(issuerId),
  ]);

  if (!user || !issuer) {
    sendError(res, 404, "Account not found");
    return;
  }

  sendSuccess(res, {
    id: user.id,
    email: user.email,
    role: user.role,
    issuerId: issuer.id,
    issuerCode: issuer.code,
    issuerName: issuer.name,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    keria: {
      aidAlias: account?.aidAlias || "",
      aidPrefix: account?.aidPrefix || "",
      registryRegk: account?.registryRegk || "",
      initializedAt: account?.initializedAt || null,
    },
  });
}

export async function accountListRequestsApi(
  req: Request,
  res: Response
): Promise<void> {
  const userId = String(req.authUser?.id || "").trim();
  if (!userId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const requests = await listAccountChangeRequests({ userId });
  sendSuccess(res, requests);
}

export async function accountCreateRequestApi(
  req: Request,
  res: Response
): Promise<void> {
  const userId = String(req.authUser?.id || "").trim();
  const issuerId = String(req.authUser?.issuerId || "").trim();
  if (!userId || !issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const fieldName = normalizeRequestField(req.body?.fieldName);
  const requestedValue = String(req.body?.requestedValue || "").trim();
  const reason = String(req.body?.reason || "").trim();

  if (!fieldName || !requestedValue) {
    sendError(res, 400, "fieldName and requestedValue are required");
    return;
  }

  const [user, issuer] = await Promise.all([
    getIssuerUserById(issuerId, userId),
    getIssuerById(issuerId),
  ]);
  if (!user || !issuer) {
    sendError(res, 404, "Account not found");
    return;
  }

  const currentValue = fieldName === "email" ? user.email : issuer.name;
  if (currentValue.trim() === requestedValue) {
    sendError(res, 400, "New value must be different from current value");
    return;
  }

  const requestRecord = await createAccountChangeRequest({
    userId,
    issuerId,
    fieldName,
    currentValue,
    requestedValue,
    reason: reason || null,
  });
  sendSuccess(res, requestRecord, 201);
}
