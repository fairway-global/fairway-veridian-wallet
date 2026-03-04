export type TemplateAttributeType =
  | "string"
  | "integer"
  | "number"
  | "boolean";

export interface TemplateAttribute {
  name: string;
  type: TemplateAttributeType;
  required: boolean;
}

export interface TemplateRecord {
  id: string;
  name: string;
  schemaId: string;
  attributes: TemplateAttribute[];
  createdAt: string;
  updatedAt: string;
}

export type IssuedCredentialStatus = "issued" | "revoked" | "deleted";

export interface IssuedCredentialRecord {
  id: string;
  templateId: string;
  schemaId: string;
  holderDid: string;
  status: IssuedCredentialStatus;
  data: Record<string, unknown>;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  deletedAt?: string;
}

export interface DashboardStoreData {
  templates: TemplateRecord[];
  credentials: IssuedCredentialRecord[];
}
