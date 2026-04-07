import { randomBytes } from "crypto";
import { Request, Response } from "express";
import { config } from "../config";
import { log } from "../log";
import { sendError, sendSuccess } from "../utils/apiResponse";
import { provisionManagedUser } from "../services/managedUserProvisioning.service";
import { IssuerSignifyService } from "../services/issuerSignifyService";
import {
  requestPasswordResetForUser,
  sendAccountChangeRequestReviewedEmail,
  sendAccountCreatedEmail,
  sendAccountStatusChangedEmail,
  sendIssuerApplicationApprovedEmail,
  sendIssuerApplicationRejectedEmail,
} from "../services/authService";
import {
  getAccountChangeRequestById,
  getIssuerApplicationRequestById,
  getManagedUserById,
  listIssuerApplicationRequests,
  listAccountChangeRequests,
  listIssuerUsersByEmail,
  listManagedUsers,
  updateIssuerApplicationRequestStatus,
  updateAccountChangeRequestStatus,
  updateIssuerNameById,
  updateIssuerUser,
} from "../services/tenantStore";
import {
  AccountChangeRequestStatus,
  IssuerApplicationRequestStatus,
} from "../services/tenantStore.types";

function maskEmail(value: string): string {
  const normalized = String(value || "").trim();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) {
    return normalized;
  }

  return `${normalized.slice(0, 2)}***${normalized.slice(atIndex)}`;
}

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

function normalizeIssuerApplicationStatus(
  value: unknown
): IssuerApplicationRequestStatus | null {
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

function generateTemporaryPassword(): string {
  return `${randomBytes(12).toString("base64url")}Aa1!`;
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
    const finalUser = refreshed || user;
    await sendAccountCreatedEmail({
      email: finalUser.email,
      role: finalUser.role,
      issuerName: finalUser.issuerName,
    });
    sendSuccess(res, finalUser, 201);
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
  const finalUser = refreshed || current;
  await sendAccountStatusChangedEmail({
    email: finalUser.email,
    role: finalUser.role,
    issuerName: finalUser.issuerName,
    isActive,
  });
  sendSuccess(res, finalUser);
}

export async function adminSendPasswordResetApi(
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

  if (config.mailDebug) {
    log("[admin.api] send-reset-password route entered", {
      userId: current.id,
      issuerId: current.issuerId,
      email: maskEmail(current.email),
      isActive: current.isActive,
    });
  }

  try {
    await requestPasswordResetForUser({
      userId: current.id,
      issuerId: current.issuerId,
      email: current.email,
      isActive: current.isActive,
    });
    if (config.mailDebug) {
      log("[admin.api] send-reset-password route succeeded", {
        userId: current.id,
        issuerId: current.issuerId,
        email: maskEmail(current.email),
      });
    }
    sendSuccess(res, {
      message:
        "If the account is active and mail is configured, a password reset email has been sent.",
    });
  } catch (error) {
    log("[admin.api] send-reset-password route failed", {
      userId: current.id,
      issuerId: current.issuerId,
      email: maskEmail(current.email),
      error: error instanceof Error ? error.message : "unknown error",
    });
    sendError(
      res,
      503,
      error instanceof Error
        ? error.message
        : "Unable to send password reset email"
    );
  }
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

export async function adminListIssuerApplicationsApi(
  req: Request,
  res: Response
): Promise<void> {
  const status = req.query?.status
    ? normalizeIssuerApplicationStatus(req.query.status)
    : null;
  if (req.query?.status && !status) {
    sendError(res, 400, "Invalid status");
    return;
  }

  const applications = await listIssuerApplicationRequests({
    status: status || undefined,
  });
  sendSuccess(res, applications);
}

export async function adminReviewIssuerApplicationApi(
  req: Request,
  res: Response
): Promise<void> {
  const requestId = String(req.params.id || "").trim();
  const reviewedBy = String(req.authUser?.id || "").trim();
  const status = normalizeIssuerApplicationStatus(req.body?.status);
  const adminNote = String(req.body?.adminNote || "").trim();

  if (!requestId || !reviewedBy || !status || status === "pending") {
    sendError(res, 400, "request id and review status are required");
    return;
  }

  const existing = await getIssuerApplicationRequestById(requestId);
  if (!existing) {
    sendError(res, 404, "Issuer request not found");
    return;
  }
  if (existing.status !== "pending") {
    sendError(res, 400, "Issuer request already reviewed");
    return;
  }

  let provisionedUserId: string | null = null;

  if (status === "approved") {
    const conflicts = await listIssuerUsersByEmail(existing.email);
    if (conflicts.length) {
      sendError(
        res,
        400,
        "An account already exists for this email. Review cannot be completed."
      );
      return;
    }

    const tempPassword = generateTemporaryPassword();
    const provisionedUser = await provisionManagedUser({
      email: existing.email,
      password: tempPassword,
      role: "issuer",
      displayName: existing.contactName,
      issuerName: existing.organizationName,
      codeBase: existing.organizationName,
      createdBy: reviewedBy,
    });
    provisionedUserId = provisionedUser.id;

    const issuerSignifyService = req.app.get(
      "issuerSignifyService"
    ) as IssuerSignifyService | undefined;
    if (issuerSignifyService) {
      try {
        await issuerSignifyService.getRuntimeByIssuerId(provisionedUser.issuerId);
      } catch (error) {
        log("[admin.api] issuer runtime warmup failed after approval", {
          requestId,
          issuerId: provisionedUser.issuerId,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    }
  }

  const updated = await updateIssuerApplicationRequestStatus({
    id: requestId,
    status,
    reviewedBy,
    adminNote: adminNote || null,
    provisionedUserId,
  });
  if (!updated) {
    sendError(res, 400, "Unable to review issuer request");
    return;
  }

  if (status === "approved") {
    await sendIssuerApplicationApprovedEmail({
      email: existing.email,
      organizationName: existing.organizationName,
    });
  } else {
    await sendIssuerApplicationRejectedEmail({
      email: existing.email,
      organizationName: existing.organizationName,
      adminNote: adminNote || null,
    });
  }

  const refreshed = await getIssuerApplicationRequestById(requestId);
  sendSuccess(res, refreshed || updated);
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

  const notificationEmail =
    status === "approved" && existing.fieldName === "email"
      ? existing.requestedValue.trim().toLowerCase()
      : String(existing.userEmail || "").trim().toLowerCase();
  if (notificationEmail) {
    await sendAccountChangeRequestReviewedEmail({
      email: notificationEmail,
      fieldName: existing.fieldName,
      requestedValue: existing.requestedValue,
      status,
      adminNote: adminNote || null,
    });
  }

  const refreshed = await getAccountChangeRequestById(requestId);
  sendSuccess(res, refreshed || updated);
}
