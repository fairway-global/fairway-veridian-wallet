import { NextFunction, Request, Response } from "express";
import { AccessTokenRole } from "../services/jwtService";
import { sendError } from "../utils/apiResponse";

export function requireRole(roles: AccessTokenRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.authUser?.role;
    if (!role || !roles.includes(role)) {
      sendError(res, 403, "Forbidden");
      return;
    }
    next();
  };
}

