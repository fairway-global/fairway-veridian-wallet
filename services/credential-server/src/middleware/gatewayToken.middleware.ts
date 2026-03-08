import { NextFunction, Request, Response } from "express";
import { verifyGatewayToken } from "../services/jwtService";
import {
  cleanupExpiredGatewayTokenJti,
  insertGatewayTokenJti,
} from "../services/tenantStore";
import { sendError } from "../utils/apiResponse";

function extractBearerToken(headerValue: string): string | null {
  const value = String(headerValue || "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = value.slice("bearer ".length).trim();
  return token || null;
}

export function requireGatewayToken(scope: string) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const token = extractBearerToken(String(req.headers.authorization || ""));
    if (!token) {
      sendError(res, 401, "Unauthorized");
      return;
    }

    try {
      await cleanupExpiredGatewayTokenJti();
      const payload = verifyGatewayToken(token);
      if (payload.scope !== scope) {
        sendError(res, 403, "Forbidden");
        return;
      }

      const inserted = await insertGatewayTokenJti({
        jti: payload.jti,
        issuerId: payload.issuer_id,
        scope: payload.scope,
        expiresAt: new Date(payload.exp * 1000),
      });
      if (!inserted) {
        sendError(res, 401, "Unauthorized");
        return;
      }

      req.gatewayToken = {
        issuerId: payload.issuer_id,
        scope: payload.scope,
        jti: payload.jti,
        exp: payload.exp,
      };
      next();
    } catch (error) {
      sendError(
        res,
        401,
        error instanceof Error ? error.message : "Unauthorized"
      );
    }
  };
}

