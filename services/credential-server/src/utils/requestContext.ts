import { Request, Response } from "express";
import { SignifyClient } from "signify-ts";
import { ISSUER_NAME } from "../consts";
import { IssuerRuntime } from "../services/issuerSignifyService";

type RequestOrResponse = Request | Response;

function getRequestLike(input: RequestOrResponse): Request {
  if ("app" in input && "method" in input) {
    return input as Request;
  }

  return (input as Response).req as Request;
}

export function getIssuerRuntime(input: RequestOrResponse): IssuerRuntime | null {
  const req = getRequestLike(input);
  return req.issuerRuntime || null;
}

export function getSignifyClientFromRequest(input: RequestOrResponse): SignifyClient {
  const req = getRequestLike(input);
  return req.issuerRuntime?.client || req.app.get("signifyClient");
}

export function getIssuerAliasFromRequest(input: RequestOrResponse): string {
  const req = getRequestLike(input);
  return (
    req.issuerRuntime?.aidAlias || req.app.get("legacyIssuerName") || ISSUER_NAME
  );
}

export function getQviCredentialIdFromRequest(input: RequestOrResponse): string {
  const req = getRequestLike(input);
  return req.issuerRuntime?.qviCredentialId || req.app.get("qviCredentialId");
}

