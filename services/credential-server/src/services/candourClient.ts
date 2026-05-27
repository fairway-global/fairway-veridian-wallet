import axios, { Method } from "axios";
import { createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";

export interface CandourCreateSessionRequest {
  timestamp: string;
  validUntil: string;
  tries?: number;
  callbackUrl: string;
  callbackPostEndpoint?: string;
  allowedVerificationMethods: {
    rfidApp: boolean;
    idApp: boolean;
    idWeb: boolean;
  };
  allowedVerificationDocuments: {
    passport: boolean;
    idCard: boolean;
  };
  resultProperties: {
    name?: boolean;
    nameMatch?: boolean;
    nameScore?: boolean;
    dateOfBirth?: boolean;
    dateOfBirthMatch?: boolean;
    nationalIdentificationNumber?: boolean;
    nationalIdentificationNumberMatch?: boolean;
    idNumber?: boolean;
    idNumberMatch?: boolean;
    idDocumentType?: boolean;
    idExpiration?: boolean;
    idIssuer?: boolean;
    nationality?: boolean;
    sex?: boolean;
    selfieImage?: boolean;
    idMrzImage?: boolean;
    idOtherImage?: boolean;
    idChipImage?: boolean;
  };
  user?: {
    identifier?: string;
  };
}

export interface CandourCreateSessionResponse {
  timestamp: string;
  redirectUrl: string;
  verificationSessionId: string;
}

export type CandourVerificationStatus =
  | "pending"
  | "opened"
  | "started"
  | "beingAnalysed"
  | "finished"
  | "finishedExpired"
  | "finishedManual";

export interface CandourResultResponse {
  timestamp: string;
  verificationSessionId: string;
  verificationTries: number;
  status: CandourVerificationStatus;
  manualOverride?: {
    manualSuccess: boolean;
    manualFailure: boolean;
    user: string;
    originalStatus: Exclude<CandourVerificationStatus, "finishedManual">;
  };
  updatedAt: string;
  verificationMethod:
    | "rfidApp"
    | "idApp"
    | "idWeb"
    | "sfovWeb"
    | "mrzApp";
  identityVerified: boolean;
  invitationLink: string;
  identifier?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  nameMatch?: boolean;
  nameScore?: number;
  dateOfBirth?: string;
  dateOfBirthMatch?: boolean;
  nationalIdentificationNumber?: string;
  nationalIdentificationNumberMatch?: boolean;
  idNumber?: string;
  idNumberMatch?: boolean;
  idDocumentType?: "passport" | "idCard";
  idExpiration?: string;
  idIssuer?: string;
  idIssuerMatch?: boolean;
  nationality?: string;
  nationalityMatch?: boolean;
  sex?: string;
  sexMatch?: boolean;
  selfieImage?: string;
  idMrzImage?: string;
  idOtherImage?: string;
  idChipImage?: string;
  errors?: string[];
  [key: string]: unknown;
}

function trimTrailingSlash(value: string): string {
  return String(value || "").replace(/\/+$/, "");
}

function signPayload(payload: string): string {
  return createHmac("sha256", config.candour.hmacKey)
    .update(payload, "utf8")
    .digest("hex");
}

function verifyResponseSignature(
  rawBody: string,
  headerValue: string | undefined
): void {
  const receivedSignature = String(headerValue || "").trim().toLowerCase();
  if (!receivedSignature || !rawBody) {
    return;
  }

  const expectedSignature = signPayload(rawBody);
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error("Candour response signature validation failed");
  }
}

function ensureCandourConfigured(): void {
  if (!config.candour.publicKey || !config.candour.hmacKey) {
    throw new Error(
      "Candour is not configured. Set CANDOUR_PUBLIC_KEY and CANDOUR_HMAC_KEY."
    );
  }
}

async function requestCandour<T>(input: {
  method: Method;
  path?: string;
  payloadToSign: string;
  body?: unknown;
}): Promise<T> {
  ensureCandourConfigured();

  const baseUrl = trimTrailingSlash(config.candour.apiBaseUrl);
  const relativePath = String(input.path || "").trim();
  const url = relativePath ? `${baseUrl}/${relativePath.replace(/^\/+/, "")}` : baseUrl;
  const headers: Record<string, string> = {
    "X-AUTH-CLIENT": config.candour.publicKey,
    "X-HMAC-SIGNATURE": signPayload(input.payloadToSign),
  };

  let requestData: string | undefined;
  if (input.body !== undefined) {
    requestData = JSON.stringify(input.body);
    headers["Content-Type"] = "application/json";
  }

  const response = await axios.request<string>({
    method: input.method,
    url,
    data: requestData,
    headers,
    responseType: "text",
    transformResponse: [(data) => data],
    validateStatus: () => true,
  });

  const rawBody = String(response.data || "");
  verifyResponseSignature(rawBody, response.headers["x-hmac-signature"]);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      rawBody || `Candour request failed with status ${response.status}`
    );
  }

  if (!rawBody) {
    return undefined as T;
  }

  return JSON.parse(rawBody) as T;
}

export async function createCandourVerificationSession(
  body: CandourCreateSessionRequest
): Promise<CandourCreateSessionResponse> {
  const payload = JSON.stringify(body);
  return requestCandour<CandourCreateSessionResponse>({
    method: "POST",
    payloadToSign: payload,
    body,
  });
}

export async function getCandourVerificationResult(
  verificationSessionId: string
): Promise<CandourResultResponse> {
  const normalizedSessionId = String(verificationSessionId || "").trim();
  return requestCandour<CandourResultResponse>({
    method: "GET",
    path: encodeURIComponent(normalizedSessionId),
    payloadToSign: normalizedSessionId,
  });
}

export async function deleteCandourVerificationResult(
  verificationSessionId: string
): Promise<void> {
  const normalizedSessionId = String(verificationSessionId || "").trim();
  await requestCandour<void>({
    method: "DELETE",
    path: encodeURIComponent(normalizedSessionId),
    payloadToSign: normalizedSessionId,
  });
}
