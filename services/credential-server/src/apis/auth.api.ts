import { Request, Response } from "express";
import {
  getAuthUserFromAccessToken,
  login,
  loginWithGoogleIdToken,
  logout,
  refresh,
} from "../services/authService";
import { sendError, sendSuccess } from "../utils/apiResponse";

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
