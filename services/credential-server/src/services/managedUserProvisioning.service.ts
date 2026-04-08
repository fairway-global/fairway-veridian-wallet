import { randomUUID } from "crypto";
import { hashPassword } from "./authService";
import { encryptSecret } from "./cryptoService";
import {
  createIssuer,
  createIssuerUser,
  getIssuerByCode,
  getManagedUserById,
  upsertIssuerSignifyAccount,
} from "./tenantStore";
import { ManagedUserRecord } from "./tenantStore.types";

type ManagedRole = "issuer" | "verifier";

function slugify(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCodeBase(input: { email: string; displayName?: string; role: ManagedRole }): string {
  const fromName = slugify(input.displayName || "");
  if (fromName) {
    return fromName;
  }

  const localPart = String(input.email || "").split("@")[0];
  const fromEmail = slugify(localPart);
  if (fromEmail) {
    return fromEmail;
  }

  return `${input.role}-${Date.now()}`;
}

async function generateUniqueIssuerCode(base: string): Promise<string> {
  const normalizedBase = slugify(base) || `org-${Date.now()}`;
  let candidate = normalizedBase;
  let counter = 1;

  while (await getIssuerByCode(candidate)) {
    candidate = `${normalizedBase}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function generateBran(): string {
  // Keep a compact, URL-safe secret for Signify account bootstrapping.
  return randomUUID().replace(/-/g, "").slice(0, 21);
}

function generateAidAlias(role: ManagedRole, issuerCode: string): string {
  const normalizedRole = role === "verifier" ? "verifier" : "issuer";
  return `${normalizedRole}-${issuerCode}`.slice(0, 60);
}

export async function provisionManagedUser(input: {
  email: string;
  password: string;
  role: ManagedRole;
  displayName?: string;
  issuerName?: string;
  codeBase?: string;
  createdBy?: string | null;
}): Promise<ManagedUserRecord> {
  const email = String(input.email || "").trim().toLowerCase();
  const role = input.role;
  const displayName = String(input.displayName || "").trim();
  const issuerName = String(input.issuerName || "").trim();
  const codeBase = String(input.codeBase || "").trim();

  const issuerCode = await generateUniqueIssuerCode(
    codeBase || normalizeCodeBase({ email, displayName, role })
  );
  const normalizedIssuerName =
    issuerName ||
    displayName ||
    `${role === "verifier" ? "Verifier" : "Issuer"} ${email}`;

  const issuer = await createIssuer({
    code: issuerCode,
    name: normalizedIssuerName,
    status: "active",
  });

  await upsertIssuerSignifyAccount({
    issuerId: issuer.id,
    branEncrypted: encryptSecret(generateBran()),
    aidAlias: generateAidAlias(role, issuerCode),
  });

  const user = await createIssuerUser({
    issuerId: issuer.id,
    email,
    passwordHash: await hashPassword(input.password),
    role,
    createdBy: input.createdBy || null,
  });

  const managed = await getManagedUserById(user.id);
  if (!managed) {
    throw new Error("Unable to load provisioned account");
  }
  return managed;
}
