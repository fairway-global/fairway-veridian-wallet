import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { config } from "../config";

function getKey(): Buffer {
  const source = String(config.branEncryptionKey || "").trim();
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string): string {
  const [ivPart, encryptedPart, tagPart] = String(value || "").split(".");
  if (!ivPart || !encryptedPart || !tagPart) {
    throw new Error("Invalid encrypted payload");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function hashToken(value: string): string {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

