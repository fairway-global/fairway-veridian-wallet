import argon2 from "argon2";
import { randomUUID } from "crypto";
import { config } from "../config";
import { hashToken } from "./cryptoService";
import {
  AccessTokenRole,
  signAccessToken,
  verifyAccessToken,
} from "./jwtService";
import {
  createRefreshTokenRecord,
  getRefreshTokenRecordByHash,
  getIssuerById,
  listIssuerUsersByEmail,
  getIssuerUserById,
  replaceRefreshToken,
  revokeRefreshTokenById,
  updateIssuerUserLastLogin,
} from "./tenantStore";

export interface AuthSessionUser {
  id: string;
  issuerId: string;
  issuerCode: string;
  email: string;
  role: AccessTokenRole;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthSessionUser;
}

function buildRefreshExpiry(): Date {
  const ms = config.refreshTokenTtlSeconds * 1000;
  return new Date(Date.now() + ms);
}

function randomToken(): string {
  return `${randomUUID()}-${randomUUID()}`;
}

async function createSession(user: AuthSessionUser): Promise<LoginResult> {
  const accessToken = signAccessToken({
    userId: user.id,
    issuerId: user.issuerId,
    role: user.role,
  });
  const refreshToken = randomToken();
  const refreshTokenId = randomUUID();

  await createRefreshTokenRecord({
    id: refreshTokenId,
    userId: user.id,
    issuerId: user.issuerId,
    tokenHash: hashToken(refreshToken),
    expiresAt: buildRefreshExpiry(),
  });

  return {
    accessToken,
    refreshToken,
    user,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const matches = await listIssuerUsersByEmail(String(input.email || "").trim());
  if (!matches.length) {
    throw new Error("Invalid credentials");
  }

  if (matches.length > 1) {
    throw new Error(
      "Multiple accounts found for this email. Contact admin to keep email unique."
    );
  }

  const userRecord = matches[0];
  if (!userRecord.isActive) {
    throw new Error("User account is disabled");
  }

  const verified = await verifyPassword(
    userRecord.passwordHash,
    String(input.password || "")
  );
  if (!verified) {
    throw new Error("Invalid credentials");
  }

  await updateIssuerUserLastLogin(userRecord.id);
  return createSession({
    id: userRecord.id,
    issuerId: userRecord.issuerId,
    issuerCode: userRecord.issuerCode,
    email: userRecord.email,
    role: userRecord.role,
  });
}

export async function refresh(input: {
  refreshToken: string;
}): Promise<LoginResult> {
  const tokenHash = hashToken(String(input.refreshToken || "").trim());
  const currentRecord = await getRefreshTokenRecordByHash(tokenHash);
  if (!currentRecord) {
    throw new Error("Invalid refresh token");
  }
  if (currentRecord.revokedAt) {
    throw new Error("Refresh token revoked");
  }
  if (new Date(currentRecord.expiresAt).getTime() <= Date.now()) {
    throw new Error("Refresh token expired");
  }

  const userRecord = await getIssuerUserById(
    currentRecord.issuerId,
    currentRecord.userId
  );
  if (!userRecord || !userRecord.isActive) {
    throw new Error("User account is disabled");
  }

  const issuer = await getIssuerById(userRecord.issuerId);
  if (!issuer) {
    throw new Error("Issuer not found");
  }

  const newRefreshToken = randomToken();
  const newRefreshTokenId = randomUUID();
  await createRefreshTokenRecord({
    id: newRefreshTokenId,
    userId: userRecord.id,
    issuerId: userRecord.issuerId,
    tokenHash: hashToken(newRefreshToken),
    expiresAt: buildRefreshExpiry(),
  });
  await replaceRefreshToken(currentRecord.id, newRefreshTokenId);

  const accessToken = signAccessToken({
    userId: userRecord.id,
    issuerId: userRecord.issuerId,
    role: userRecord.role,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: userRecord.id,
      issuerId: userRecord.issuerId,
      issuerCode: issuer.code,
      email: userRecord.email,
      role: userRecord.role,
    },
  };
}

export async function logout(input: { refreshToken: string }): Promise<void> {
  const tokenHash = hashToken(String(input.refreshToken || "").trim());
  const record = await getRefreshTokenRecordByHash(tokenHash);
  if (!record) {
    return;
  }
  await revokeRefreshTokenById(record.id);
}

export async function getAuthUserFromAccessToken(
  token: string
): Promise<AuthSessionUser> {
  const payload = verifyAccessToken(token);
  const userRecord = await getIssuerUserById(payload.issuer_id, payload.sub);
  if (!userRecord) {
    throw new Error("User not found");
  }
  if (!userRecord.isActive) {
    throw new Error("User account is disabled");
  }
  const issuer = await getIssuerById(payload.issuer_id);
  if (!issuer) {
    throw new Error("Issuer not found");
  }

  return {
    id: userRecord.id,
    issuerId: userRecord.issuerId,
    issuerCode: issuer.code,
    email: userRecord.email,
    role: userRecord.role,
  };
}
