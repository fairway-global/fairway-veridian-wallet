import { ManagedCredential, CredentialTemplate } from "../../services/template.types";

export interface CredentialListRow {
  id: string;
  templateName: string;
  holderDid: string;
  status: string;
  issuedAt: number;
}

export interface IssueCredentialFormValues {
  templateId: string;
  connectionId: string;
  values: Record<string, string>;
}

export interface IssueCredentialFormDependencies {
  templates: CredentialTemplate[];
  connections: Array<{
    id: string;
    alias: string;
  }>;
}

export interface CredentialDetailState extends ManagedCredential {
  templateName: string;
}
