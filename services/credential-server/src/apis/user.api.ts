import { Request, Response } from "express";
import { hashPassword } from "../services/authService";
import {
  createIssuerUser,
  listIssuerUsersByEmail,
  listIssuerUsers,
  updateIssuerUser,
} from "../services/tenantStore";
import { sendError, sendSuccess } from "../utils/apiResponse";
import { AccessTokenRole } from "../services/jwtService";

const ROLE_SET = new Set<AccessTokenRole>([
  "admin",
  "issuer",
  "verifier",
]);

function normalizeRole(value: unknown): AccessTokenRole | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ROLE_SET.has(normalized as AccessTokenRole)
    ? (normalized as AccessTokenRole)
    : null;
}

export async function listUsersApi(req: Request, res: Response): Promise<void> {
  const issuerId = String(req.authUser?.issuerId || "").trim();
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const users = await listIssuerUsers(issuerId);
  sendSuccess(
    res,
    users.map((user) => ({
      id: user.id,
      issuerId: user.issuerId,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdBy: user.createdBy,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }))
  );
}

export async function createUserApi(req: Request, res: Response): Promise<void> {
  const issuerId = String(req.authUser?.issuerId || "").trim();
  const createdBy = String(req.authUser?.id || "").trim();
  if (!issuerId || !createdBy) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = normalizeRole(req.body?.role);

  if (!email || !password || !role) {
    sendError(res, 400, "email, password and role are required");
    return;
  }

  try {
    const existingByEmail = await listIssuerUsersByEmail(email);
    if (existingByEmail.length) {
      sendError(res, 400, "Email already in use");
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await createIssuerUser({
      issuerId,
      email,
      passwordHash,
      role,
      createdBy,
    });
    sendSuccess(
      res,
      {
        id: user.id,
        issuerId: user.issuerId,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdBy: user.createdBy,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      201
    );
  } catch (error) {
    sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unable to create user"
    );
  }
}

export async function patchUserApi(req: Request, res: Response): Promise<void> {
  const issuerId = String(req.authUser?.issuerId || "").trim();
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const userId = String(req.params.id || "").trim();
  if (!userId) {
    sendError(res, 400, "user id is required");
    return;
  }

  const normalizedRole = req.body?.role ? normalizeRole(req.body.role) : null;
  if (req.body?.role && !normalizedRole) {
    sendError(res, 400, "Invalid role");
    return;
  }
  const role = normalizedRole || undefined;

  const isActive =
    typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;
  const password =
    typeof req.body?.password === "string" ? String(req.body.password) : "";
  const passwordHash = password ? await hashPassword(password) : undefined;

  const updated = await updateIssuerUser(issuerId, userId, {
    role,
    isActive,
    passwordHash,
  });
  if (!updated) {
    sendError(res, 404, "User not found");
    return;
  }

  sendSuccess(res, {
    id: updated.id,
    issuerId: updated.issuerId,
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive,
    createdBy: updated.createdBy,
    lastLoginAt: updated.lastLoginAt,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
}
