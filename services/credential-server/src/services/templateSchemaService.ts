import { SignifyClient } from "signify-ts";
import { config } from "../config";
import { canonicalSchemaId } from "../consts";
import {
  createSchemaForTemplate,
  getSchemaDocument,
} from "./dashboardStore";
import { TemplateAttribute, TemplateAttributeType } from "./dashboardStore.types";
import {
  ensureSchemaUsableForIssuer,
  registerSchemaForIssuer,
  syncSchemaVisibilityForIssuer,
} from "./schemaAccessService";
import { resolveOobi } from "../utils/utils";

const IGNORED_SCHEMA_ATTRIBUTE_KEYS = new Set(["d", "i", "u", "dt"]);
const ATTRIBUTE_TYPE_SET = new Set<TemplateAttributeType>([
  "string",
  "integer",
  "number",
  "boolean",
]);

type SchemaDocument = {
  properties?: {
    a?: {
      oneOf?: Array<{
        properties?: Record<string, { type?: unknown }>;
        required?: unknown[];
      }>;
    };
  };
};

function normalizeAttributeType(value: unknown): TemplateAttributeType {
  const normalized = String(value || "string")
    .trim()
    .toLowerCase() as TemplateAttributeType;

  return ATTRIBUTE_TYPE_SET.has(normalized) ? normalized : "string";
}

export function normalizeTemplateAttributes(
  attributes: TemplateAttribute[]
): TemplateAttribute[] {
  if (!Array.isArray(attributes)) {
    return [];
  }

  return attributes
    .map((attribute) => ({
      name: String(attribute?.name || "").trim(),
      type: normalizeAttributeType(attribute?.type),
      required: Boolean(attribute?.required),
    }))
    .filter((attribute) => Boolean(attribute.name));
}

export function extractTemplateAttributesFromSchemaDocument(
  schemaDocument: Record<string, unknown> | null | undefined
): TemplateAttribute[] {
  const schema = (schemaDocument || {}) as SchemaDocument;
  const subjectDefinition = schema.properties?.a?.oneOf?.[1];
  const properties = subjectDefinition?.properties || {};
  const requiredFields = new Set(
    Array.isArray(subjectDefinition?.required) ? subjectDefinition.required : []
  );

  return Object.keys(properties)
    .filter((name) => !IGNORED_SCHEMA_ATTRIBUTE_KEYS.has(name))
    .map((name) => ({
      name,
      type: normalizeAttributeType(properties[name]?.type),
      required: requiredFields.has(name),
    }));
}

function getComparableAttributeSignature(attribute: TemplateAttribute): string {
  return `${attribute.name}:${attribute.type}:${attribute.required ? "1" : "0"}`;
}

export function templateAttributesEqual(
  left: TemplateAttribute[],
  right: TemplateAttribute[]
): boolean {
  const normalizedLeft = normalizeTemplateAttributes(left)
    .map(getComparableAttributeSignature)
    .sort();
  const normalizedRight = normalizeTemplateAttributes(right)
    .map(getComparableAttributeSignature)
    .sort();

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export async function getSchemaDocumentFromClientOrStore(
  client: SignifyClient,
  schemaId: string
): Promise<Record<string, unknown> | null> {
  const normalizedSchemaId = canonicalSchemaId(String(schemaId || "").trim());
  if (!normalizedSchemaId) {
    return null;
  }

  try {
    const schema = await client.schemas().get(normalizedSchemaId);
    if (schema && typeof schema === "object") {
      return schema as Record<string, unknown>;
    }
  } catch {
    // Fall back to locally persisted schemas when Keria has not loaded it yet.
  }

  return getSchemaDocument(normalizedSchemaId);
}

function buildSchemaOobiCandidates(schemaId: string): string[] {
  const normalizedSchemaId = canonicalSchemaId(String(schemaId || "").trim());
  const rawBases = [
    String(config.oobiEndpoint || "").trim(),
    String(config.endpoint || "").trim(),
    String(process.env.PUBLIC_OOBI_ENDPOINT || "").trim(),
  ].filter(Boolean);

  const candidates = rawBases.flatMap((base) => {
    try {
      const parsed = new URL(base);
      const variants = [base];

      if (parsed.hostname === "localhost") {
        const localhostVariant = new URL(base);
        localhostVariant.hostname = "127.0.0.1";
        variants.push(localhostVariant.toString());

        const dockerVariant = new URL(base);
        dockerVariant.hostname = "host.docker.internal";
        variants.push(dockerVariant.toString());

        const bridgeVariant = new URL(base);
        bridgeVariant.hostname = "172.17.0.1";
        variants.push(bridgeVariant.toString());
      } else if (parsed.hostname === "127.0.0.1") {
        const loopbackVariant = new URL(base);
        loopbackVariant.hostname = "localhost";
        variants.push(loopbackVariant.toString());

        const dockerVariant = new URL(base);
        dockerVariant.hostname = "host.docker.internal";
        variants.push(dockerVariant.toString());
      }

      return variants.map(
        (variant) => `${variant.replace(/\/+$/, "")}/oobi/${normalizedSchemaId}`
      );
    } catch {
      return [`${base.replace(/\/+$/, "")}/oobi/${normalizedSchemaId}`];
    }
  });

  return Array.from(new Set(candidates));
}

export async function ensureSchemaPublishedToKeria(
  client: SignifyClient,
  schemaId: string
): Promise<void> {
  const normalizedSchemaId = canonicalSchemaId(String(schemaId || "").trim());
  if (!normalizedSchemaId) {
    throw new Error("Schema id is required");
  }

  try {
    await client.schemas().get(normalizedSchemaId);
    return;
  } catch {
    // Resolve via OOBI below.
  }

  const candidates = buildSchemaOobiCandidates(normalizedSchemaId);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      await resolveOobi(client, candidate);
      await client.schemas().get(normalizedSchemaId);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  const message =
    lastError instanceof Error && lastError.message
      ? lastError.message
      : "Unknown schema publication failure";

  throw new Error(
    `Generated schema ${normalizedSchemaId} could not be loaded into Keria. Tried OOBI URLs: ${candidates.join(
      ", "
    )}. Last error: ${message}`
  );
}

export async function resolveTemplateSchemaForPublication(input: {
  client: SignifyClient;
  issuerId?: string;
  name: string;
  schemaId?: string;
  attributes: TemplateAttribute[];
  schemaPublic?: boolean;
}): Promise<{
  schemaId: string;
  attributes: TemplateAttribute[];
  generated: boolean;
}> {
  const templateName = String(input.name || "").trim();
  const selectedSchemaId = canonicalSchemaId(String(input.schemaId || "").trim());
  const normalizedAttributes = normalizeTemplateAttributes(input.attributes);
  const requestedSchemaVisibility =
    typeof input.schemaPublic === "boolean" ? input.schemaPublic : undefined;

  if (!selectedSchemaId) {
    const generatedSchemaId = await createSchemaForTemplate(
      templateName,
      normalizedAttributes
    );
    await ensureSchemaPublishedToKeria(input.client, generatedSchemaId);
    if (input.issuerId) {
      await registerSchemaForIssuer({
        issuerId: input.issuerId,
        schemaId: generatedSchemaId,
        isPublic: requestedSchemaVisibility ?? false,
      });
    }
    return {
      schemaId: generatedSchemaId,
      attributes: normalizedAttributes,
      generated: true,
    };
  }

  if (input.issuerId) {
    await ensureSchemaUsableForIssuer(input.issuerId, selectedSchemaId);
  }

  const schemaDocument = await getSchemaDocumentFromClientOrStore(
    input.client,
    selectedSchemaId
  );
  if (!schemaDocument) {
    throw new Error(`Template schemaId is unsupported: ${selectedSchemaId}`);
  }

  const baseAttributes = extractTemplateAttributesFromSchemaDocument(schemaDocument);
  const effectiveAttributes = normalizedAttributes.length
    ? normalizedAttributes
    : baseAttributes;

  if (templateAttributesEqual(effectiveAttributes, baseAttributes)) {
    if (input.issuerId && requestedSchemaVisibility !== undefined) {
      await syncSchemaVisibilityForIssuer({
        issuerId: input.issuerId,
        schemaId: selectedSchemaId,
        isPublic: requestedSchemaVisibility,
      });
    }

    return {
      schemaId: selectedSchemaId,
      attributes: effectiveAttributes,
      generated: false,
    };
  }

  const generatedSchemaId = await createSchemaForTemplate(
    templateName,
    effectiveAttributes
  );
  await ensureSchemaPublishedToKeria(input.client, generatedSchemaId);
  if (input.issuerId) {
    await registerSchemaForIssuer({
      issuerId: input.issuerId,
      schemaId: generatedSchemaId,
      isPublic: requestedSchemaVisibility ?? false,
    });
  }
  return {
    schemaId: generatedSchemaId,
    attributes: effectiveAttributes,
    generated: true,
  };
}
