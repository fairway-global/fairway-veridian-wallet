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

export interface CredentialTemplate {
  id: string;
  name: string;
  schemaId: string;
  attributes: TemplateAttribute[];
  autoIssue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDetail extends CredentialTemplate {
  issuedCredentials: ManagedCredential[];
}

export type ManagedCredentialStatus = "issued" | "revoked" | "deleted";

export interface ManagedCredential {
  id: string;
  templateId: string;
  templateName?: string;
  schemaId: string;
  holderDid: string;
  status: ManagedCredentialStatus;
  data: Record<string, unknown>;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  deletedAt?: string;
}

export interface TemplateUpsertInput {
  name: string;
  schemaId: string;
  attributes: TemplateAttribute[];
  autoIssue: boolean;
}

export interface IssueCredentialPayload {
  templateId: string;
  connectionId: string;
  values: Record<string, unknown>;
}
