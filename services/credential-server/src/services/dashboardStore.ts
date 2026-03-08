import { existsSync, mkdirSync, readFileSync, statSync } from "fs";
import { readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { Saider } from "signify-ts";
import { ACDC_SCHEMAS, canonicalSchemaId } from "../consts";
import {
  DashboardStoreData,
  IssuedCredentialRecord,
  TemplateAttribute,
  TemplateAttributeType,
  TemplateRecord,
} from "./dashboardStore.types";

const DEFAULT_DASHBOARD_DB_PATH = path.resolve(
  __dirname,
  "../../data/dashboard-db.json"
);
const GENERATED_SCHEMA_DIR_PATH = path.resolve(
  process.cwd(),
  "data/schemas"
);
const DASHBOARD_DB_PATH = path.resolve(
  process.env.DASHBOARD_DB_PATH || DEFAULT_DASHBOARD_DB_PATH
);
const ACTIVE_SCHEMA_DIR_PATH = path.resolve(__dirname, "../schemas");
const IGNORED_SCHEMA_ATTRIBUTE_KEYS = new Set(["d", "i", "u", "dt"]);
const ATTRIBUTE_TYPE_SET = new Set<TemplateAttributeType>([
  "string",
  "integer",
  "number",
  "boolean",
]);

interface SchemaListItem {
  id: string;
  name: string;
}

type DashboardStoreMutator<T> = (data: DashboardStoreData) => Promise<T> | T;

let dashboardStoreWriteQueue: Promise<void> = Promise.resolve();
let dashboardStoreReadyPromise: Promise<void> | null = null;

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map((item) => path.resolve(item))));
}

function getSchemaDirCandidates(): string[] {
  const envPath = String(process.env.SCHEMA_DIR_PATH || "").trim();

  return uniquePaths(
    [
      GENERATED_SCHEMA_DIR_PATH,
      ACTIVE_SCHEMA_DIR_PATH,
      path.resolve(__dirname, "../../src/schemas"),
      path.resolve(process.cwd(), "src/schemas"),
      path.resolve(process.cwd(), "build/schemas"),
      path.resolve(process.cwd(), "services/credential-server/src/schemas"),
      path.resolve(process.cwd(), "services/credential-server/build/schemas"),
      envPath || "",
    ].filter(Boolean)
  );
}

function getExistingSchemaDirs(): string[] {
  return getSchemaDirCandidates().filter((dirPath) => {
    if (!existsSync(dirPath)) {
      return false;
    }

    try {
      return statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  });
}

function findSchemaFilePath(schemaId: string): string | null {
  const normalizedSchemaId = canonicalSchemaId(String(schemaId || "").trim());
  if (!normalizedSchemaId) {
    return null;
  }

  for (const schemaDirPath of getExistingSchemaDirs()) {
    const candidatePath = path.join(schemaDirPath, normalizedSchemaId);
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeAttributeType(value: unknown): TemplateAttributeType {
  const normalized = String(value || "string")
    .trim()
    .toLowerCase() as TemplateAttributeType;
  return ATTRIBUTE_TYPE_SET.has(normalized) ? normalized : "string";
}

function normalizeAttribute(value: Partial<TemplateAttribute>): TemplateAttribute {
  return {
    name: String(value.name || "").trim(),
    type: normalizeAttributeType(value.type),
    required: Boolean(value.required),
  };
}

function normalizeTemplateRecord(template: TemplateRecord): TemplateRecord {
  return {
    ...template,
    name: String(template.name || "").trim(),
    schemaId: canonicalSchemaId(String(template.schemaId || "").trim()),
    attributes: Array.isArray(template.attributes)
      ? template.attributes
          .map((item) => normalizeAttribute(item))
          .filter((item) => item.name)
      : [],
  };
}

function schemaFilePath(schemaId: string): string {
  return path.join(GENERATED_SCHEMA_DIR_PATH, canonicalSchemaId(schemaId));
}

function ensureSchemaDirectoryExists(dirPath = GENERATED_SCHEMA_DIR_PATH): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function isSchemaIdKnown(schemaId: string): boolean {
  const normalizedSchemaId = canonicalSchemaId(String(schemaId || "").trim());
  if (!normalizedSchemaId) {
    return false;
  }

  return Boolean(findSchemaFilePath(normalizedSchemaId));
}

function toCredentialTypeName(value: string): string {
  const words = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!words.length) {
    return "GeneratedCredential";
  }

  const pascalCase = words
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");

  if (!pascalCase.length) {
    return "GeneratedCredential";
  }

  if (!/^[A-Za-z]/.test(pascalCase)) {
    return `Schema${pascalCase}`;
  }

  return `${pascalCase}Credential`;
}

function buildGeneratedSchemaDocument(
  templateName: string,
  attributes: TemplateAttribute[]
): Record<string, unknown> {
  const attributeProperties: Record<
    string,
    { description: string; type: string; format?: string }
  > = {
    d: {
      description: "Attributes block SAID",
      type: "string",
    },
    i: {
      description: "Issuee AID",
      type: "string",
    },
    dt: {
      description: "Issuance date time",
      type: "string",
      format: "date-time",
    },
  };

  for (const attribute of attributes) {
    if (!attribute.name) {
      continue;
    }

    attributeProperties[attribute.name] = {
      description: attribute.name,
      type: attribute.type,
    };
  }

  const attributeRequired = [
    "i",
    "dt",
    ...attributes.filter((item) => item.required).map((item) => item.name),
  ];

  const attributeBlock = {
    $id: "",
    description: "Attributes block",
    type: "object",
    properties: attributeProperties,
    additionalProperties: false,
    required: Array.from(new Set(attributeRequired)),
  };

  const [, saidifiedAttributeBlock] = Saider.saidify(
    attributeBlock,
    undefined,
    undefined,
    "$id"
  );

  const schemaDocument = {
    $id: "",
    $schema: "http://json-schema.org/draft-07/schema#",
    title: templateName,
    description: `Auto-generated schema for template ${templateName}.`,
    type: "object",
    credentialType: toCredentialTypeName(templateName),
    version: "1.0.0",
    properties: {
      v: {
        description: "Version",
        type: "string",
      },
      d: {
        description: "Credential SAID",
        type: "string",
      },
      u: {
        description: "One time use nonce",
        type: "string",
      },
      i: {
        description: "Issuee AID",
        type: "string",
      },
      ri: {
        description: "Credential status registry",
        type: "string",
      },
      s: {
        description: "Schema SAID",
        type: "string",
      },
      a: {
        oneOf: [
          {
            description: "Attributes block SAID",
            type: "string",
          },
          saidifiedAttributeBlock,
        ],
      },
    },
    additionalProperties: false,
    required: ["i", "ri", "s", "d", "a"],
  };

  const [, saidifiedSchemaDocument] = Saider.saidify(
    schemaDocument,
    undefined,
    undefined,
    "$id"
  );

  return saidifiedSchemaDocument;
}

async function persistGeneratedSchemaDocument(
  schemaId: string,
  schemaDocument: Record<string, unknown>
): Promise<void> {
  const targetDirs = uniquePaths([
    GENERATED_SCHEMA_DIR_PATH,
    ACTIVE_SCHEMA_DIR_PATH,
  ]);

  await Promise.all(
    targetDirs.map(async (dirPath) => {
      ensureSchemaDirectoryExists(dirPath);
      const filePath = path.join(dirPath, canonicalSchemaId(schemaId));
      if (!existsSync(filePath)) {
        await writeFile(filePath, JSON.stringify(schemaDocument, null, 2));
      }
    })
  );
}

export async function createSchemaForTemplate(
  templateName: string,
  attributes: TemplateAttribute[]
): Promise<string> {
  const schemaDocument = buildGeneratedSchemaDocument(templateName, attributes);
  const schemaId = String(schemaDocument["$id"] || "").trim();
  if (!schemaId) {
    throw new Error("Unable to generate schema SAID");
  }

  await persistGeneratedSchemaDocument(schemaId, schemaDocument);

  return schemaId;
}

export async function ensureGeneratedSchemaForTemplate(input: {
  schemaId: string;
  name: string;
  attributes: TemplateAttribute[];
}): Promise<boolean> {
  const normalizedSchemaId = canonicalSchemaId(String(input.schemaId || "").trim());
  if (!normalizedSchemaId) {
    return false;
  }

  if (isSchemaIdKnown(normalizedSchemaId)) {
    return true;
  }

  const schemaDocument = buildGeneratedSchemaDocument(
    String(input.name || "").trim(),
    Array.isArray(input.attributes) ? input.attributes : []
  );
  const regeneratedSchemaId = canonicalSchemaId(
    String(schemaDocument["$id"] || "").trim()
  );

  if (!regeneratedSchemaId || regeneratedSchemaId !== normalizedSchemaId) {
    return false;
  }

  await persistGeneratedSchemaDocument(regeneratedSchemaId, schemaDocument);
  return isSchemaIdKnown(regeneratedSchemaId);
}

function getSchemaTitle(schemaId: string): string {
  const schemaPath = findSchemaFilePath(schemaId);
  if (!schemaPath) {
    return schemaId;
  }

  try {
    const raw = readFileSync(schemaPath, "utf8");
    const parsed = JSON.parse(raw) as { title?: unknown };
    const parsedTitle = String(parsed.title || "").trim();
    return parsedTitle || schemaId;
  } catch {
    return schemaId;
  }
}

export async function listAvailableSchemas(): Promise<SchemaListItem[]> {
  const schemaMap = new Map<string, string>();

  ACDC_SCHEMAS.forEach((schema) => {
    schemaMap.set(schema.id, schema.name);
  });

  const schemaDirs = getExistingSchemaDirs();
  for (const schemaDirPath of schemaDirs) {
    const schemaEntries = await readdir(schemaDirPath, {
      withFileTypes: true,
    });

    for (const entry of schemaEntries) {
      if (!entry.isFile()) {
        continue;
      }

      const schemaId = String(entry.name || "").trim();
      if (!schemaId || schemaMap.has(schemaId)) {
        continue;
      }

      schemaMap.set(schemaId, getSchemaTitle(schemaId));
    }
  }

  return Array.from(schemaMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseSchemaAttributes(schemaId: string): TemplateAttribute[] {
  const schemaPath = findSchemaFilePath(schemaId);
  if (!schemaPath) {
    return [];
  }

  try {
    const schemaRaw = readFileSync(schemaPath, "utf8");
    const schemaJson = JSON.parse(schemaRaw) as {
      properties?: {
        a?: {
          oneOf?: Array<{
            properties?: Record<string, { type?: string }>;
            required?: string[];
          }>;
        };
      };
    };

    const credentialSubjectDefinition = schemaJson.properties?.a?.oneOf?.[1];
    const properties = credentialSubjectDefinition?.properties || {};
    const requiredKeys = new Set(credentialSubjectDefinition?.required || []);

    return Object.keys(properties)
      .filter((key) => !IGNORED_SCHEMA_ATTRIBUTE_KEYS.has(key))
      .map((key) => ({
        name: key,
        type: normalizeAttributeType(properties[key]?.type),
        required: requiredKeys.has(key),
      }));
  } catch {
    return [];
  }
}

async function buildDefaultTemplates(): Promise<TemplateRecord[]> {
  const createdAt = nowIso();

  return ACDC_SCHEMAS.map((schema) => ({
    id: randomUUID(),
    name: schema.name,
    schemaId: schema.id,
    attributes: parseSchemaAttributes(schema.id),
    createdAt,
    updatedAt: createdAt,
  }));
}

async function mergeMissingDefaultTemplates(
  store: DashboardStoreData
): Promise<{ data: DashboardStoreData; addedDefaultTemplates: boolean }> {
  const existingSchemaIds = new Set(
    store.templates.map((template) => template.schemaId)
  );
  const defaultTemplates = await buildDefaultTemplates();
  const missingDefaultTemplates = defaultTemplates.filter(
    (template) => !existingSchemaIds.has(template.schemaId)
  );

  if (!missingDefaultTemplates.length) {
    return {
      data: store,
      addedDefaultTemplates: false,
    };
  }

  return {
    data: {
      ...store,
      templates: [...store.templates, ...missingDefaultTemplates],
    },
    addedDefaultTemplates: true,
  };
}

function getEmptyStoreData(): DashboardStoreData {
  return {
    templates: [],
    credentials: [],
  };
}

async function ensureDashboardStoreFile(): Promise<void> {
  if (dashboardStoreReadyPromise) {
    await dashboardStoreReadyPromise;
    return;
  }

  dashboardStoreReadyPromise = (async () => {
    const dataDir = path.dirname(DASHBOARD_DB_PATH);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    if (existsSync(DASHBOARD_DB_PATH)) {
      return;
    }

    const defaultTemplates = await buildDefaultTemplates();
    const initialState: DashboardStoreData = {
      templates: defaultTemplates,
      credentials: [],
    };

    await writeFile(DASHBOARD_DB_PATH, JSON.stringify(initialState, null, 2));
  })();

  try {
    await dashboardStoreReadyPromise;
  } finally {
    dashboardStoreReadyPromise = null;
  }
}

export function getSchemaAttributesForSchemaId(
  schemaId: string
): TemplateAttribute[] {
  return parseSchemaAttributes(schemaId);
}

async function withDashboardStoreUpdate<T>(
  mutator: DashboardStoreMutator<T>
): Promise<T> {
  let result!: T;
  let thrownError: unknown;

  const runUpdate = async () => {
    await ensureDashboardStoreFile();
    const db = await readDashboardStoreFromDisk();

    try {
      result = await mutator(db);
      await writeDashboardStore(db);
    } catch (error) {
      thrownError = error;
    }
  };

  dashboardStoreWriteQueue = dashboardStoreWriteQueue.then(runUpdate, runUpdate);
  await dashboardStoreWriteQueue;

  if (thrownError) {
    throw thrownError;
  }

  return result;
}

async function readDashboardStoreFromDisk(): Promise<DashboardStoreData> {
  const dataDir = path.dirname(DASHBOARD_DB_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  let persistStore = false;
  let parsedStore: DashboardStoreData = getEmptyStoreData();

  try {
    const content = await readFile(DASHBOARD_DB_PATH, "utf8");
    const parsed = JSON.parse(content) as Partial<DashboardStoreData>;
    parsedStore = {
      templates: Array.isArray(parsed.templates)
        ? parsed.templates.map((item) => normalizeTemplateRecord(item))
        : [],
      credentials: Array.isArray(parsed.credentials)
        ? parsed.credentials
        : [],
    };
  } catch {
    persistStore = true;
    parsedStore = getEmptyStoreData();
  }

  const { data, addedDefaultTemplates } =
    await mergeMissingDefaultTemplates(parsedStore);
  if (persistStore || addedDefaultTemplates) {
    await writeDashboardStore(data);
  }

  return data;
}

async function readDashboardStore(): Promise<DashboardStoreData> {
  await ensureDashboardStoreFile();

  let data!: DashboardStoreData;
  const readFromDisk = async () => {
    data = await readDashboardStoreFromDisk();
  };

  dashboardStoreWriteQueue = dashboardStoreWriteQueue.then(readFromDisk, readFromDisk);
  await dashboardStoreWriteQueue;

  return data;
}

async function writeDashboardStore(data: DashboardStoreData): Promise<void> {
  await writeFile(DASHBOARD_DB_PATH, JSON.stringify(data, null, 2));
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  const db = await readDashboardStore();
  return db.templates;
}

export async function getTemplateById(
  templateId: string
): Promise<TemplateRecord | null> {
  const db = await readDashboardStore();
  return db.templates.find((template) => template.id === templateId) || null;
}

export interface UpsertTemplateInput {
  id?: string;
  name: string;
  schemaId: string;
  attributes: TemplateAttribute[];
}

interface ValidateTemplateInputOptions {
  requireSchemaId: boolean;
}

function validateTemplateInput(
  input: UpsertTemplateInput,
  options: ValidateTemplateInputOptions
): string | null {
  if (!input.name?.trim()) {
    return "Template name is required";
  }

  const schemaId = String(input.schemaId || "").trim();
  if (options.requireSchemaId && !schemaId) {
    return "Template schemaId is required";
  }

  if (schemaId && !isSchemaIdKnown(schemaId)) {
    return `Template schemaId is unsupported: ${schemaId}`;
  }

  if (!Array.isArray(input.attributes)) {
    return "Template attributes must be an array";
  }

  for (const attribute of input.attributes) {
    if (!attribute.name?.trim()) {
      return "Template attribute name is required";
    }
  }

  return null;
}

export async function createTemplate(
  input: UpsertTemplateInput
): Promise<TemplateRecord> {
  const error = validateTemplateInput(input, {
    requireSchemaId: false,
  });
  if (error) {
    throw new Error(error);
  }

  return withDashboardStoreUpdate(async (db) => {
    const timestamp = nowIso();
    const schemaId = String(input.schemaId || "").trim()
      ? canonicalSchemaId(String(input.schemaId || "").trim())
      : await createSchemaForTemplate(input.name, input.attributes);
    const attributes =
      input.attributes.length > 0
        ? input.attributes
        : parseSchemaAttributes(schemaId);
    const newTemplate: TemplateRecord = normalizeTemplateRecord({
      id: randomUUID(),
      name: input.name,
      schemaId,
      attributes,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    db.templates.push(newTemplate);
    return newTemplate;
  });
}

export async function updateTemplate(
  templateId: string,
  input: UpsertTemplateInput
): Promise<TemplateRecord | null> {
  const error = validateTemplateInput(input, {
    requireSchemaId: true,
  });
  if (error) {
    throw new Error(error);
  }

  return withDashboardStoreUpdate((db) => {
    const currentTemplate = db.templates.find((item) => item.id === templateId);
    if (!currentTemplate) {
      return null;
    }

    const updatedTemplate: TemplateRecord = normalizeTemplateRecord({
      ...currentTemplate,
      name: input.name,
      schemaId: canonicalSchemaId(input.schemaId),
      attributes:
        input.attributes.length > 0
          ? input.attributes
          : parseSchemaAttributes(canonicalSchemaId(input.schemaId)),
      updatedAt: nowIso(),
    });

    db.templates = db.templates.map((template) =>
      template.id === templateId ? updatedTemplate : template
    );

    return updatedTemplate;
  });
}

export async function deleteTemplate(templateId: string): Promise<boolean> {
  return withDashboardStoreUpdate((db) => {
    const originalLength = db.templates.length;
    db.templates = db.templates.filter((template) => template.id !== templateId);
    return db.templates.length !== originalLength;
  });
}

export async function listIssuedCredentialRecords(): Promise<IssuedCredentialRecord[]> {
  const db = await readDashboardStore();
  return db.credentials;
}

export async function getIssuedCredentialRecordById(
  credentialId: string
): Promise<IssuedCredentialRecord | null> {
  const db = await readDashboardStore();
  return db.credentials.find((item) => item.id === credentialId) || null;
}

export async function upsertIssuedCredentialRecord(
  record: IssuedCredentialRecord
): Promise<IssuedCredentialRecord> {
  return withDashboardStoreUpdate((db) => {
    const existingIndex = db.credentials.findIndex((item) => item.id === record.id);

    if (existingIndex >= 0) {
      db.credentials[existingIndex] = {
        ...db.credentials[existingIndex],
        ...record,
        updatedAt: nowIso(),
      };
    } else {
      db.credentials.push({
        ...record,
        createdAt: record.createdAt || nowIso(),
        updatedAt: record.updatedAt || nowIso(),
      });
    }

    return record;
  });
}

export async function markIssuedCredentialStatus(
  credentialId: string,
  status: IssuedCredentialRecord["status"]
): Promise<IssuedCredentialRecord | null> {
  return withDashboardStoreUpdate((db) => {
    const current = db.credentials.find((item) => item.id === credentialId);
    if (!current) {
      return null;
    }

    const timestamp = nowIso();
    const updated: IssuedCredentialRecord = {
      ...current,
      status,
      updatedAt: timestamp,
      revokedAt: status === "revoked" ? timestamp : current.revokedAt,
      deletedAt: status === "deleted" ? timestamp : current.deletedAt,
    };

    db.credentials = db.credentials.map((item) =>
      item.id === credentialId ? updated : item
    );

    return updated;
  });
}

export async function findTemplateBySchemaId(
  schemaId: string
): Promise<TemplateRecord | null> {
  const db = await readDashboardStore();
  const normalizedSchemaId = canonicalSchemaId(schemaId);
  return (
    db.templates.find(
      (template) => canonicalSchemaId(template.schemaId) === normalizedSchemaId
    ) || null
  );
}
