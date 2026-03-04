import { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { sendError } from "../utils/apiResponse";

export function requireDashboardAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = String(config.dashboardApiToken || "").trim();
  if (!token) {
    next();
    return;
  }

  const authorizationHeader = String(req.headers.authorization || "").trim();
  if (authorizationHeader === `Bearer ${token}`) {
    next();
    return;
  }

  sendError(res, 401, "Unauthorized");
}
