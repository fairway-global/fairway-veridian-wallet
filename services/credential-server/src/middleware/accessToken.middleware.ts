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

export async function requireAccessToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(String(req.headers.authorization || ""));
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

