import { Request, Response } from "express";
import { RealtimeEventService } from "../services/realtimeEventService";
import { sendError } from "../utils/apiResponse";

function getIssuerId(req: Request): string {
  return String(req.authUser?.issuerId || req.issuerRuntime?.issuerId || "").trim();
}

export async function eventStreamApiV2(
  req: Request,
  res: Response
): Promise<void> {
  const issuerId = getIssuerId(req);
  if (!issuerId) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  const realtimeService = req.app.get(
    "realtimeEventService"
  ) as RealtimeEventService | null;
  if (!realtimeService) {
    sendError(res, 500, "Realtime service not initialized");
    return;
  }

  const unsubscribe = realtimeService.subscribe(issuerId, res);
  req.on("close", unsubscribe);
}
