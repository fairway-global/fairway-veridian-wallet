import argon2 from "argon2";
import { randomBytes, randomUUID } from "crypto";
import { config } from "../config";
import { hashToken } from "./cryptoService";
import { log } from "../log";
import {
  AccessTokenRole,
  signAccessToken,
  verifyAccessToken,
} from "./jwtService";
import {
  createPasswordResetTokenRecord,
  createRefreshTokenRecord,
  getPasswordResetTokenRecordByHash,
  getRefreshTokenRecordByHash,
  getIssuerById,
  listIssuerUsersByEmail,
  getIssuerUserById,
  markPasswordResetTokenUsed,
  replaceRefreshToken,
  revokePasswordResetTokensByUserId,
  revokeRefreshTokenById,
  revokeRefreshTokensByUserId,
  updateIssuerUser,
  updateIssuerUserLastLogin,
} from "./tenantStore";
import {
  buildAccountCreatedEmail,
  buildAccountChangeRequestReviewedEmail,
  buildAccountStatusChangedEmail,
  buildIssuerApplicationApprovedEmail,
  buildIssuerApplicationReceivedEmail,
  buildIssuerApplicationRejectedEmail,
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildVerifierSignupEmail,
} from "./mailTemplateService";
import {
  isMailConfigured,
  sendTransactionalEmail,
  sendTransactionalEmailBestEffort,
} from "./mailService";

export type PasswordResetRequestStatus = "sent" | "failed";
export type PasswordResetRequestReason =
  | "email_sent"
  | "account_not_found"
  | "multiple_accounts"
  | "inactive_user";

export interface PasswordResetRequestResult {
  status: PasswordResetRequestStatus;
  reason: PasswordResetRequestReason;
  message: string;
  accountExists: boolean;
}

export interface AuthSessionUser {
  id: string;
  issuerId: string;
  issuerCode: string;
  email: string;
  role: AccessTokenRole;
}

export interface VerifiedGoogleProfile {
  email: string;
  name: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthSessionUser;
}

function maskEmail(value: string): string {
  const normalized = String(value || "").trim();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) {
    return normalized;
  }

  return `${normalized.slice(0, 2)}***${normalized.slice(atIndex)}`;
}

type JoseModule = typeof import("jose");

let joseModulePromise: Promise<JoseModule> | null = null;
let googleJwks: ReturnType<JoseModule["createRemoteJWKSet"]> | null = null;

async function loadJose(): Promise<JoseModule> {
  if (!joseModulePromise) {
    const dynamicImport = new Function(
      "modulePath",
      "return import(modulePath)"
    ) as (modulePath: string) => Promise<JoseModule>;
    joseModulePromise = dynamicImport("jose");
  }

  return joseModulePromise;
}

async function getGoogleJoseContext(): Promise<{
  jose: JoseModule;
  jwks: ReturnType<JoseModule["createRemoteJWKSet"]>;
}> {
  const jose = await loadJose();
  if (!googleJwks) {
    googleJwks = jose.createRemoteJWKSet(
      new URL("https://www.googleapis.com/oauth2/v3/certs")
    );
  }

  return {
    jose,
    jwks: googleJwks,
  };
}

function buildRefreshExpiry(): Date {
  const ms = config.refreshTokenTtlSeconds * 1000;
  return new Date(Date.now() + ms);
}

function buildPasswordResetExpiry(): Date {
  const ms = config.passwordResetTtlSeconds * 1000;
  return new Date(Date.now() + ms);
}

function randomToken(): string {
  return `${randomUUID()}-${randomUUID()}`;
}

function randomResetToken(): string {
  return randomBytes(32).toString("base64url");
}

function buildPasswordResetUrl(token: string): string {
  const baseUrl = String(config.dashboardUiUrl || "").replace(/\/+$/g, "");
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildSignInUrl(): string {
  return `${String(config.dashboardUiUrl || "").replace(/\/+$/g, "")}/login`;
}

function buildForgotPasswordUrl(): string {
  return `${String(config.dashboardUiUrl || "").replace(/\/+$/g, "")}/forgot-password`;
}

function formatDuration(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${seconds} seconds`;
}

async function createAndSendPasswordResetEmail(input: {
  userId: string;
  issuerId: string;
  email: string;
  isActive: boolean;
}): Promise<void> {
  if (!input.isActive) {
    throw new Error("User account is inactive");
  }

  if (config.mailDebug) {
    log("[auth][reset-email] preparing reset email", {
      userId: input.userId,
      issuerId: input.issuerId,
      email: maskEmail(input.email),
    });
  }

  const resetToken = randomResetToken();
  const expiresAt = buildPasswordResetExpiry();
  await createPasswordResetTokenRecord({
    id: randomUUID(),
    userId: input.userId,
    issuerId: input.issuerId,
    tokenHash: hashToken(resetToken),
    expiresAt,
  });

  if (config.mailDebug) {
    log("[auth][reset-email] reset token stored", {
      userId: input.userId,
      issuerId: input.issuerId,
      email: maskEmail(input.email),
      expiresAt: expiresAt.toISOString(),
    });
  }

  const mail = buildPasswordResetEmail({
    resetUrl: buildPasswordResetUrl(resetToken),
    expiresInText: formatDuration(config.passwordResetTtlSeconds),
  });

  try {
    await sendTransactionalEmail({
      to: input.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (config.mailDebug) {
      log("[auth][reset-email] delivery completed", {
        userId: input.userId,
        issuerId: input.issuerId,
        email: maskEmail(input.email),
      });
    }
  } catch (error) {
    log("[auth][reset-email] delivery failed", {
      userId: input.userId,
      issuerId: input.issuerId,
      email: maskEmail(input.email),
      error: error instanceof Error ? error.message : "unknown error",
    });
    throw error;
  }
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

async function createSessionForUserRecord(userRecord: {
  id: string;
  issuerId: string;
  issuerCode: string;
  email: string;
  role: AccessTokenRole;
}): Promise<LoginResult> {
  await updateIssuerUserLastLogin(userRecord.id);
  return createSession({
    id: userRecord.id,
    issuerId: userRecord.issuerId,
    issuerCode: userRecord.issuerCode,
    email: userRecord.email,
    role: userRecord.role,
  });
}

export async function verifyGoogleIdTokenProfile(
  idToken: string
): Promise<VerifiedGoogleProfile> {
  if (!config.googleClientId) {
    throw new Error("Google sign in is not configured");
  }

  const { jose, jwks } = await getGoogleJoseContext();
  const { payload } = await jose.jwtVerify(idToken, jwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: config.googleClientId,
  });

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";

  if (!email || !emailVerified) {
    throw new Error("Google account email is not verified");
  }

  const fullName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : typeof payload.given_name === "string" && payload.given_name.trim()
        ? payload.given_name.trim()
        : email.split("@")[0];

  return {
    email,
    name: fullName,
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

  return createSessionForUserRecord(userRecord);
}

export async function loginWithGoogleIdToken(input: {
  idToken: string;
}): Promise<LoginResult> {
  const { email } = await verifyGoogleIdTokenProfile(
    String(input.idToken || "").trim()
  );
  const matches = await listIssuerUsersByEmail(email);

  if (!matches.length) {
    throw new Error("No account found for this Google sign-in");
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

  return createSessionForUserRecord(userRecord);
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

export async function requestPasswordReset(input: {
  email: string;
}): Promise<PasswordResetRequestResult> {
  const email = String(input.email || "").trim().toLowerCase();
  if (config.mailDebug) {
    log("[auth][forgot-password] request received", {
      email: maskEmail(email),
    });
  }
  if (!email) {
    return {
      status: "failed",
      reason: "account_not_found",
      message: "No account found for that email.",
      accountExists: false,
    };
  }

  if (!isMailConfigured()) {
    throw new Error("Password reset email service is not configured");
  }

  const matches = await listIssuerUsersByEmail(email);
  if (config.mailDebug) {
    log("[auth][forgot-password] user lookup completed", {
      email: maskEmail(email),
      matches: matches.length,
    });
  }
  if (!matches.length) {
    return {
      status: "failed",
      reason: "account_not_found",
      message: "No account found for that email.",
      accountExists: false,
    };
  }

  if (matches.length > 1) {
    log(
      `[auth] skipping password reset for ${email}: multiple dashboard accounts matched`
    );
    return {
      status: "failed",
      reason: "multiple_accounts",
      message:
        "Multiple accounts matched this email. Contact admin to make the email unique.",
      accountExists: true,
    };
  }

  const userRecord = matches[0];
  if (!userRecord.isActive) {
    return {
      status: "failed",
      reason: "inactive_user",
      message: "This account is inactive and cannot receive password reset email.",
      accountExists: true,
    };
  }

  await createAndSendPasswordResetEmail({
    userId: userRecord.id,
    issuerId: userRecord.issuerId,
    email: userRecord.email,
    isActive: userRecord.isActive,
  });
  if (config.mailDebug) {
    log("[auth][forgot-password] request completed", {
      email: maskEmail(email),
      userId: userRecord.id,
      issuerId: userRecord.issuerId,
      status: "sent",
    });
  }
  return {
    status: "sent",
    reason: "email_sent",
    message: "Password reset email sent.",
    accountExists: true,
  };
}

export async function requestPasswordResetForUser(input: {
  userId: string;
  issuerId: string;
  email: string;
  isActive: boolean;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error("Password reset email service is not configured");
  }

  if (config.mailDebug) {
    log("[auth][admin-reset-email] request received", {
      userId: input.userId,
      issuerId: input.issuerId,
      email: maskEmail(input.email),
      isActive: input.isActive,
    });
  }

  await createAndSendPasswordResetEmail(input);

  if (config.mailDebug) {
    log("[auth][admin-reset-email] request completed", {
      userId: input.userId,
      issuerId: input.issuerId,
      email: maskEmail(input.email),
      status: "sent",
    });
  }
}

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<void> {
  const token = String(input.token || "").trim();
  const password = String(input.password || "");
  if (!token) {
    throw new Error("Reset token is required");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const record = await getPasswordResetTokenRecordByHash(hashToken(token));
  if (!record) {
    throw new Error("Reset link is invalid or has expired");
  }
  if (record.usedAt) {
    throw new Error("Reset link has already been used");
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new Error("Reset link has expired");
  }

  const userRecord = await getIssuerUserById(record.issuerId, record.userId);
  if (!userRecord || !userRecord.isActive) {
    throw new Error("User account is disabled");
  }

  const passwordHash = await hashPassword(password);
  const updatedUser = await updateIssuerUser(record.issuerId, record.userId, {
    passwordHash,
  });
  if (!updatedUser) {
    throw new Error("User account not found");
  }

  await markPasswordResetTokenUsed(record.id);
  await revokePasswordResetTokensByUserId(record.userId);
  await revokeRefreshTokensByUserId(record.userId);

  const mail = buildPasswordChangedEmail();
  await sendTransactionalEmailBestEffort(
    {
      to: updatedUser.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    },
    "password reset confirmation"
  );
}

export async function sendAccountCreatedEmail(input: {
  email: string;
  role: AccessTokenRole;
  issuerName: string;
}): Promise<void> {
  const mail = buildAccountCreatedEmail({
    role: input.role,
    issuerName: input.issuerName,
    signInUrl: buildSignInUrl(),
    resetUrl: buildForgotPasswordUrl(),
  });

  await sendTransactionalEmailBestEffort(
    {
      to: input.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    },
    "account created notification"
  );
}

export async function sendVerifierSignupEmail(input: {
  email: string;
  issuerName: string;
  authMethod: "password" | "google";
}): Promise<void> {
  const mail = buildVerifierSignupEmail({
    issuerName: input.issuerName,
    signInUrl: buildSignInUrl(),
    resetUrl: buildForgotPasswordUrl(),
    authMethod: input.authMethod,
  });

  await sendTransactionalEmailBestEffort(
    {
      to: input.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    },
    "verifier signup notification"
  );
}

export async function sendIssuerApplicationReceivedEmail(input: {
  email: string;
  organizationName: string;
}): Promise<void> {
  const mail = buildIssuerApplicationReceivedEmail({
    organizationName: input.organizationName,
  });

  await sendTransactionalEmailBestEffort(
    {
      to: input.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    },
    "issuer request received notification"
  );
}

export async function sendIssuerApplicationApprovedEmail(input: {
  email: string;
  organizationName: string;
  temporaryPassword?: string | null;
}): Promise<void> {
  const mail = buildIssuerApplicationApprovedEmail({
    organizationName: input.organizationName,
    signInUrl: buildSignInUrl(),
    resetUrl: buildForgotPasswordUrl(),
    temporaryPassword: input.temporaryPassword || null,
  });

  await sendTransactionalEmailBestEffort(
    {
      to: input.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    },
    "issuer request approved notification"
  );
}

export async function sendIssuerApplicationRejectedEmail(input: {
  email: string;
  organizationName: string;
  adminNote?: string | null;
}): Promise<void> {
  const mail = buildIssuerApplicationRejectedEmail({
    organizationName: input.organizationName,
    adminNote: input.adminNote || null,
  });

  await sendTransactionalEmailBestEffort(
    {
      to: input.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    },
    "issuer request rejected notification"
  );
}

export async function sendAccountStatusChangedEmail(input: {
  email: string;
  role: AccessTokenRole;
  issuerName: string;
  isActive: boolean;
}): Promise<void> {
  const mail = buildAccountStatusChangedEmail({
    role: input.role,
    issuerName: input.issuerName,
    isActive: input.isActive,
  });

  await sendTransactionalEmailBestEffort(
    {
      to: input.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    },
    "account status changed notification"
  );
}

export async function sendAccountChangeRequestReviewedEmail(input: {
  email: string;
  fieldName: string;
  requestedValue: string;
  status: "approved" | "rejected";
  adminNote?: string | null;
}): Promise<void> {
  const mail = buildAccountChangeRequestReviewedEmail({
    fieldName: input.fieldName,
    requestedValue: input.requestedValue,
    status: input.status,
    adminNote: input.adminNote || null,
  });

  await sendTransactionalEmailBestEffort(
    {
      to: input.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    },
    "account change request reviewed notification"
  );
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
