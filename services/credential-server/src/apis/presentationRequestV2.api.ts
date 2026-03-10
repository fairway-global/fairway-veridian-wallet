import { Request, Response } from "express";
import { getIssuerRuntime } from "../utils/requestContext";
import { sendError, sendSuccess } from "../utils/apiResponse";
import { listPresentationRequests } from "../services/presentationRequestService";

export async function listPresentationRequestsApiV2(
  req: Request,
  res: Response
): Promise<void> {
  const runtime = getIssuerRuntime(req);
  if (!runtime) {
    sendError(res, 500, "Issuer runtime is not initialized");
    return;
  }

  const records = await listPresentationRequests(runtime);
  sendSuccess(res, records);
}
