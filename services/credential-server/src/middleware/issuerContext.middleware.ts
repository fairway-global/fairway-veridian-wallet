import { NextFunction, Request, Response } from "express";
import { IssuerSignifyService } from "../services/issuerSignifyService";
import { sendError } from "../utils/apiResponse";

export async function requireIssuerContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const issuerId = String(
    req.authUser?.issuerId || req.gatewayToken?.issuerId || ""
  ).trim();
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const issuerSignifyService = req.app.get(
    "issuerSignifyService"
  ) as IssuerSignifyService | undefined;
  if (!issuerSignifyService) {
    sendError(res, 500, "Issuer runtime is not initialized");
    return;
  }

  try {
    req.issuerRuntime = await issuerSignifyService.getRuntimeByIssuerId(issuerId);
    next();
  } catch (error) {
    sendError(
      res,
      500,
      error instanceof Error
        ? error.message
        : "Unable to initialize issuer context"
    );
  }
}
