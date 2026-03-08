import { NextFunction, Request, Response } from "express";
import { getAuthUserFromAccessToken } from "../services/authService";
import { sendError } from "../utils/apiResponse";

function extractBearerToken(headerValue: string): string | null {
  const value = String(headerValue || "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = value.slice("bearer ".length).trim();
  return token || null;
}

function extractAccessToken(req: Request): string | null {
  const authHeaderToken = extractBearerToken(
    String(req.headers.authorization || "")
  );
  if (authHeaderToken) {
    return authHeaderToken;
  }

  const queryToken = String(req.query.accessToken || "").trim();
  return queryToken || null;
}

export async function requireAccessTokenForStream(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractAccessToken(req);
  if (!token) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  try {
    req.authUser = await getAuthUserFromAccessToken(token);
    next();
  } catch {
    sendError(res, 401, "Unauthorized");
  }
}
