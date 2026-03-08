import { NextFunction, Request, Response } from "express";
import { getOobi } from "../utils/utils";
import {
  getIssuerAliasFromRequest,
  getIssuerRuntime,
  getSignifyClientFromRequest,
} from "../utils/requestContext";

export async function keriOobiApi(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const client = getSignifyClientFromRequest(req);
  const issuerAlias = getIssuerAliasFromRequest(req);
  const issuerRuntime = getIssuerRuntime(req);
  const displayName =
    issuerRuntime?.issuerName || issuerRuntime?.aidAlias || "Credential Issuance";

  const url = `${await getOobi(
    client,
    issuerAlias
  )}?name=${encodeURIComponent(displayName)}`;
  res.status(200).send({
    success: true,
    data: url,
  });
}
