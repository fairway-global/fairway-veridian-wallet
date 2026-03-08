import { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/apiResponse";
import { provisionManagedUser } from "../services/managedUserProvisioning.service";
import { IssuerSignifyService } from "../services/issuerSignifyService";
import {
  getAccountChangeRequestById,
  getManagedUserById,
  listAccountChangeRequests,
  listIssuerUsersByEmail,
  listManagedUsers,
  updateAccountChangeRequestStatus,
  updateIssuerNameById,
  updateIssuerUser,
} from "../services/tenantStore";
import { AccountChangeRequestStatus } from "../services/tenantStore.types";

function normalizeManagedRole(value: unknown): "issuer" | "verifier" | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "issuer" || normalized === "verifier") {
    return normalized;
  }
  return null;
}

function normalizeRequestStatus(value: unknown): AccountChangeRequestStatus | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "approved" ||
    normalized === "rejected"
  ) {
    return normalized;
  }
  return null;
}

export async function adminListUsersApi(
  req: Request,
  res: Response
): Promise<void> {
  const users = await listManagedUsers();
  sendSuccess(res, users);
}

export async function adminCreateUserApi(
  req: Request,
  res: Response
): Promise<void> {
  const createdBy = String(req.authUser?.id || "").trim();
  if (!createdBy) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = normalizeManagedRole(req.body?.role);
  const displayName = String(req.body?.displayName || "").trim();

  if (!email || !password || !role) {
    sendError(res, 400, "email, password and role are required");
    return;
  }

  const existingByEmail = await listIssuerUsersByEmail(email);
  if (existingByEmail.length) {
    sendError(res, 400, "Email already in use");
    return;
  }

  try {
    const user = await provisionManagedUser({
      email,
      password,
      role,
      displayName,
      createdBy,
    });

    const issuerSignifyService = req.app.get(
      "issuerSignifyService"
    ) as IssuerSignifyService | undefined;
    if (issuerSignifyService) {
      await issuerSignifyService.getRuntimeByIssuerId(user.issuerId);
    }

    const refreshed = await getManagedUserById(user.id);
    sendSuccess(res, refreshed || user, 201);
  } catch (error) {
    sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unable to create account"
    );
  }
}

export async function adminPatchUserApi(
  req: Request,
  res: Response
): Promise<void> {
  const userId = String(req.params.id || "").trim();
  if (!userId) {
    sendError(res, 400, "user id is required");
    return;
  }

  const current = await getManagedUserById(userId);
  if (!current) {
    sendError(res, 404, "User not found");
    return;
  }

  const isActive =
    typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;
  if (typeof isActive !== "boolean") {
    sendError(res, 400, "isActive is required");
    return;
  }

  const updated = await updateIssuerUser(current.issuerId, userId, { isActive });
  if (!updated) {
    sendError(res, 404, "User not found");
    return;
  }

  const refreshed = await getManagedUserById(userId);
  sendSuccess(res, refreshed || updated);
}

export async function adminListRequestsApi(
  req: Request,
  res: Response
): Promise<void> {
  const status = req.query?.status
    ? normalizeRequestStatus(req.query.status)
    : null;
  if (req.query?.status && !status) {
    sendError(res, 400, "Invalid status");
    return;
  }

  const requests = await listAccountChangeRequests({
    status: status || undefined,
  });
  sendSuccess(res, requests);
}

export async function adminReviewRequestApi(
  req: Request,
  res: Response
): Promise<void> {
  const requestId = String(req.params.id || "").trim();
  const reviewedBy = String(req.authUser?.id || "").trim();
  const status = normalizeRequestStatus(req.body?.status);
  const adminNote = String(req.body?.adminNote || "").trim();

  if (!requestId || !reviewedBy || !status || status === "pending") {
    sendError(res, 400, "request id and review status are required");
    return;
  }

  const existing = await getAccountChangeRequestById(requestId);
  if (!existing) {
    sendError(res, 404, "Request not found");
    return;
  }
  if (existing.status !== "pending") {
    sendError(res, 400, "Request already reviewed");
    return;
  }

  if (status === "approved") {
    if (existing.fieldName === "issuer_name") {
      const updatedIssuer = await updateIssuerNameById(
        existing.issuerId,
        existing.requestedValue
      );
      if (!updatedIssuer) {
        sendError(res, 404, "Issuer not found");
        return;
      }
    } else if (existing.fieldName === "email") {
      const normalizedEmail = existing.requestedValue.trim().toLowerCase();
      const conflicts = await listIssuerUsersByEmail(normalizedEmail);
      const hasConflict = conflicts.some((user) => user.id !== existing.userId);
      if (hasConflict) {
        sendError(res, 400, "Email already in use");
        return;
      }

      const updatedUser = await updateIssuerUser(existing.issuerId, existing.userId, {
        email: normalizedEmail,
      });
      if (!updatedUser) {
        sendError(res, 404, "User not found");
        return;
      }
    }
  }

  const updated = await updateAccountChangeRequestStatus({
    id: requestId,
    status,
    reviewedBy,
    adminNote: adminNote || null,
  });
  if (!updated) {
    sendError(res, 400, "Unable to review request");
    return;
  }

  if (status === "approved") {
    const issuerSignifyService = req.app.get(
      "issuerSignifyService"
    ) as IssuerSignifyService | undefined;
    issuerSignifyService?.clearCache();
  }

  const refreshed = await getAccountChangeRequestById(requestId);
  sendSuccess(res, refreshed || updated);
}
