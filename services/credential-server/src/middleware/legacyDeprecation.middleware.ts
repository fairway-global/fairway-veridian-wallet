import { NextFunction, Request, Response } from "express";
import { log } from "../log";

export function legacyDeprecationNotice(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("Deprecation", "true");
  res.setHeader(
    "Warning",
    `299 - "Legacy unauthenticated endpoint is deprecated. Migrate to /api/v2 and authenticated routes."`
  );
  log(`[LEGACY] Deprecated endpoint called: ${req.method} ${req.originalUrl}`);
  next();
}

