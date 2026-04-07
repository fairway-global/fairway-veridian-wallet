import { randomBytes } from "crypto";
import { Request, Response } from "express";
import {
  getAuthUserFromAccessToken,
  login,
  loginWithGoogleIdToken,
  logout,
  sendAccountCreatedEmail,
  sendIssuerApplicationReceivedEmail,
  requestPasswordReset,
  resetPassword,
  refresh,
  verifyGoogleIdTokenProfile,
} from "../services/authService";
import {
  createIssuerApplicationRequest,
  getPendingIssuerApplicationRequestByEmail,
  listIssuerUsersByEmail,
} from "../services/tenantStore";
import { provisionManagedUser } from "../services/managedUserProvisioning.service";
import { config } from "../config";
import { log } from "../log";
import { sendError, sendSuccess } from "../utils/apiResponse";

function maskEmail(value: string): string {
  const normalized = String(value || "").trim();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) {
    return normalized;
  }

  return `${normalized.slice(0, 2)}***${normalized.slice(atIndex)}`;
}

function extractBearerToken(value: string): string | null {
  const normalized = String(value || "").trim();
  if (!normalized.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return normalized.slice("bearer ".length).trim() || null;
}

export async function loginApi(req: Request, res: Response): Promise<void> {
  try {
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      sendError(res, 400, "email and password are required");
      return;
    }

    const session = await login({ email, password });
    sendSuccess(res, session);
  } catch (error) {
    sendError(
      res,
      401,
      error instanceof Error ? error.message : "Invalid credentials"
    );
  }
}

export async function refreshApi(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = String(req.body?.refreshToken || "").trim();
    if (!refreshToken) {
      sendError(res, 400, "refreshToken is required");
      return;
    }

    const session = await refresh({ refreshToken });
    sendSuccess(res, session);
  } catch (error) {
    sendError(
      res,
      401,
      error instanceof Error ? error.message : "Invalid refresh token"
    );
  }
}

export async function googleLoginApi(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const idToken = String(req.body?.idToken || "").trim();

    if (!idToken) {
      sendError(res, 400, "idToken is required");
      return;
    }

    const session = await loginWithGoogleIdToken({ idToken });
    sendSuccess(res, session);
  } catch (error) {
    sendError(
      res,
      401,
      error instanceof Error ? error.message : "Google sign in failed"
    );
  }
}

export async function registerVerifierWithGoogleApi(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const idToken = String(req.body?.idToken || "").trim();
    const organizationName = String(req.body?.organizationName || "").trim();

    if (!idToken) {
      sendError(res, 400, "idToken is required");
      return;
    }

    const profile = await verifyGoogleIdTokenProfile(idToken);
    const email = profile.email.trim().toLowerCase();
    const displayName = profile.name.trim() || email.split("@")[0];

    const [existingUsers, pendingIssuerRequest] = await Promise.all([
      listIssuerUsersByEmail(email),
      getPendingIssuerApplicationRequestByEmail(email),
    ]);

    if (existingUsers.length) {
      sendError(
        res,
        400,
        "An account already exists for this email. Use Google sign in instead."
      );
      return;
    }

    if (pendingIssuerRequest) {
      sendError(
        res,
        400,
        "This email already has a pending issuer request. Wait for review or use a different email."
      );
      return;
    }

    const issuerName = organizationName || `${displayName} Verifier Workspace`;
    await provisionManagedUser({
      email,
      password: randomBytes(32).toString("base64url"),
      role: "verifier",
      displayName,
      issuerName,
      codeBase: organizationName || displayName,
      createdBy: null,
    });

    await sendAccountCreatedEmail({
      email,
      role: "verifier",
      issuerName,
    });

    const session = await loginWithGoogleIdToken({ idToken });
    sendSuccess(res, session, 201);
  } catch (error) {
    sendError(
      res,
      400,
      error instanceof Error
        ? error.message
        : "Unable to create verifier access with Google"
    );
  }
}

export async function registerVerifierApi(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const displayName = String(req.body?.displayName || "").trim();
    const organizationName = String(req.body?.organizationName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!displayName || !email || !password) {
      sendError(res, 400, "displayName, email and password are required");
      return;
    }

    if (password.length < 8) {
      sendError(res, 400, "Password must be at least 8 characters long");
      return;
    }

    const [existingUsers, pendingIssuerRequest] = await Promise.all([
      listIssuerUsersByEmail(email),
      getPendingIssuerApplicationRequestByEmail(email),
    ]);

    if (existingUsers.length) {
      sendError(res, 400, "Email already in use");
      return;
    }

    if (pendingIssuerRequest) {
      sendError(
        res,
        400,
        "This email already has a pending issuer request. Wait for review or use a different email."
      );
      return;
    }

    const issuerName = organizationName || `${displayName} Verifier Workspace`;
    await provisionManagedUser({
      email,
      password,
      role: "verifier",
      displayName,
      issuerName,
      codeBase: organizationName || displayName,
      createdBy: null,
    });

    await sendAccountCreatedEmail({
      email,
      role: "verifier",
      issuerName,
    });

    const session = await login({ email, password });
    sendSuccess(res, session, 201);
  } catch (error) {
    sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unable to create verifier account"
    );
  }
}

export async function requestIssuerAccessApi(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organizationName = String(req.body?.organizationName || "").trim();
    const organizationType = String(req.body?.organizationType || "").trim();
    const contactName = String(req.body?.contactName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phoneNumber = String(req.body?.phoneNumber || "").trim();
    const country = String(req.body?.country || "").trim();
    const website = String(req.body?.website || "").trim();
    const credentialUseCase = String(req.body?.credentialUseCase || "").trim();
    const expectedVolume = String(req.body?.expectedVolume || "").trim();
    const notes = String(req.body?.notes || "").trim();

    if (!organizationName || !contactName || !email || !credentialUseCase) {
      sendError(
        res,
        400,
        "organizationName, contactName, email and credentialUseCase are required"
      );
      return;
    }

    const [existingUsers, pendingIssuerRequest] = await Promise.all([
      listIssuerUsersByEmail(email),
      getPendingIssuerApplicationRequestByEmail(email),
    ]);

    if (existingUsers.length) {
      sendError(
        res,
        400,
        "An account already exists for this email. Sign in or reset your password instead."
      );
      return;
    }

    if (pendingIssuerRequest) {
      sendError(
        res,
        400,
        "An issuer request is already pending for this email."
      );
      return;
    }

    const requestRecord = await createIssuerApplicationRequest({
      organizationName,
      organizationType: organizationType || null,
      contactName,
      email,
      phoneNumber: phoneNumber || null,
      country: country || null,
      website: website || null,
      credentialUseCase,
      expectedVolume: expectedVolume || null,
      notes: notes || null,
    });

    await sendIssuerApplicationReceivedEmail({
      email,
      organizationName,
    });

    sendSuccess(
      res,
      {
        id: requestRecord.id,
        status: requestRecord.status,
        message:
          "Issuer request submitted. We will review it and email you the outcome.",
      },
      201
    );
  } catch (error) {
    sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unable to submit issuer request"
    );
  }
}

export async function forgotPasswordApi(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      sendError(res, 400, "email is required");
      return;
    }

    if (config.mailDebug) {
      log("[auth.api] forgot-password route entered", {
        email: maskEmail(email),
      });
    }

    const result = await requestPasswordReset({ email });
    if (config.mailDebug) {
      log("[auth.api] forgot-password route succeeded", {
        email: maskEmail(email),
        ...result,
      });
    }
    sendSuccess(res, result);
  } catch (error) {
    log("[auth.api] forgot-password route failed", {
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

export async function resetPasswordApi(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    if (!token || !password) {
      sendError(res, 400, "token and password are required");
      return;
    }

    await resetPassword({ token, password });
    sendSuccess(res, { reset: true });
  } catch (error) {
    sendError(
      res,
      400,
      error instanceof Error ? error.message : "Unable to reset password"
    );
  }
}

export async function logoutApi(req: Request, res: Response): Promise<void> {
  const refreshToken = String(req.body?.refreshToken || "").trim();
  if (!refreshToken) {
    sendError(res, 400, "refreshToken is required");
    return;
  }

  await logout({ refreshToken });
  sendSuccess(res, { loggedOut: true });
}

export async function meApi(req: Request, res: Response): Promise<void> {
  const bearer = extractBearerToken(String(req.headers.authorization || ""));
  if (!bearer) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  try {
    const user = await getAuthUserFromAccessToken(bearer);
    sendSuccess(res, user);
  } catch (error) {
    sendError(
      res,
      401,
      error instanceof Error ? error.message : "Unauthorized"
    );
  }
}
