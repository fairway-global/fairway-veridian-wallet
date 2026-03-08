import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { config } from "../config";

export type AccessTokenRole = "admin" | "issuer" | "verifier";

export interface AccessTokenPayload {
  sub: string;
  issuer_id: string;
  role: AccessTokenRole;
  type: "access";
  jti: string;
  iat: number;
  exp: number;
}

export interface GatewayTokenPayload {
  sub?: string;
  issuer_id: string;
  scope: string;
  jti: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
}

interface DecodedJwtPayload {
  [key: string]: unknown;
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signParts(headerPart: string, payloadPart: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${headerPart}.${payloadPart}`);
  return toBase64Url(hmac.digest());
}

function parseJwt(token: string): {
  headerPart: string;
  payloadPart: string;
  signaturePart: string;
  payload: DecodedJwtPayload;
} {
  const [headerPart, payloadPart, signaturePart] = String(token || "").split(".");
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error("Malformed JWT");
  }

  const payloadRaw = fromBase64Url(payloadPart);
  const payload = JSON.parse(payloadRaw) as DecodedJwtPayload;
  return {
    headerPart,
    payloadPart,
    signaturePart,
    payload,
  };
}

function assertTokenTime(payload: DecodedJwtPayload): void {
  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp || 0);
  if (!exp || now >= exp) {
    throw new Error("Token expired");
  }
}

export function signAccessToken(input: {
  userId: string;
  issuerId: string;
  role: AccessTokenRole;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: input.userId,
    issuer_id: input.issuerId,
    role: input.role,
    type: "access",
    jti: randomUUID(),
    iat: now,
    exp: now + config.accessTokenTtlSeconds,
  };

  const headerPart = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = signParts(
    headerPart,
    payloadPart,
    config.jwtAccessSecret
  );

  return `${headerPart}.${payloadPart}.${signaturePart}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const parsed = parseJwt(token);
  const expectedSig = signParts(
    parsed.headerPart,
    parsed.payloadPart,
    config.jwtAccessSecret
  );

  const received = Buffer.from(parsed.signaturePart);
  const expected = Buffer.from(expectedSig);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new Error("Invalid token signature");
  }

  assertTokenTime(parsed.payload);
  if (parsed.payload.type !== "access") {
    throw new Error("Invalid token type");
  }
  if (!parsed.payload.sub || !parsed.payload.issuer_id || !parsed.payload.role) {
    throw new Error("Missing token claims");
  }

  return {
    sub: String(parsed.payload.sub),
    issuer_id: String(parsed.payload.issuer_id),
    role: String(parsed.payload.role) as AccessTokenRole,
    type: "access",
    jti: String(parsed.payload.jti),
    iat: Number(parsed.payload.iat),
    exp: Number(parsed.payload.exp),
  };
}

export function verifyGatewayToken(token: string): GatewayTokenPayload {
  const parsed = parseJwt(token);
  const expectedSig = signParts(
    parsed.headerPart,
    parsed.payloadPart,
    config.gatewayJwtSecret
  );

  const received = Buffer.from(parsed.signaturePart);
  const expected = Buffer.from(expectedSig);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new Error("Invalid token signature");
  }

  assertTokenTime(parsed.payload);
  const issuerId = String(parsed.payload.issuer_id || "").trim();
  const scope = String(parsed.payload.scope || "").trim();
  const jti = String(parsed.payload.jti || "").trim();
  const iat = Number(parsed.payload.iat || 0);
  const exp = Number(parsed.payload.exp || 0);
  if (!issuerId || !scope || !jti || !iat || !exp) {
    throw new Error("Missing gateway token claims");
  }

  if (
    config.gatewayJwtIssuer &&
    String(parsed.payload.iss || "").trim() !== config.gatewayJwtIssuer
  ) {
    throw new Error("Invalid gateway token issuer");
  }
  if (
    config.gatewayJwtAudience &&
    String(parsed.payload.aud || "").trim() !== config.gatewayJwtAudience
  ) {
    throw new Error("Invalid gateway token audience");
  }

  const tokenAge = Math.floor(Date.now() / 1000) - iat;
  if (tokenAge < 0 || tokenAge > config.gatewayTokenMaxAgeSeconds) {
    throw new Error("Gateway token max age exceeded");
  }

  return {
    ...parsed.payload,
    issuer_id: issuerId,
    scope,
    jti,
    iat,
    exp,
  } as GatewayTokenPayload;
}
