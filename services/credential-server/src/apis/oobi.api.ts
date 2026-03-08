import { NextFunction, Request, Response } from "express";
import { resolveOobi as resolveOobiFromUtils } from "../utils/utils";
import { getSignifyClientFromRequest } from "../utils/requestContext";
import { RealtimeEventService } from "../services/realtimeEventService";

export async function resolveOobi(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const client = getSignifyClientFromRequest(req);
  const { oobi } = req.body;

  await resolveOobiFromUtils(client, oobi);
  const issuerId = String(req.authUser?.issuerId || req.issuerRuntime?.issuerId || "").trim();
  const realtimeService = req.app.get(
    "realtimeEventService"
  ) as RealtimeEventService | null;
  if (issuerId && realtimeService) {
    realtimeService.publishToIssuer(issuerId, {
      type: "connections.refresh",
      notification: {
        title: "Connection request sent",
        message: "A connection update was detected.",
        level: "info",
      },
    });
  }

  res.status(200).send({
    success: true,
    data: "OOBI resolved successfully",
  });
}
