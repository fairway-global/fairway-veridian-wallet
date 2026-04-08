import {
  CredentialTemplate,
  TemplateAttribute,
} from "../../services/template.types";

export interface TemplateFormState {
  name: string;
  schemaId: string;
  attributes: TemplateAttribute[];
  autoIssue: boolean;
  schemaPublic: boolean;
}

export interface TemplateFormProps {
  initialValue?: TemplateFormState;
  loading?: boolean;
  submitLabel: string;
  onSubmit: (value: TemplateFormState) => Promise<void> | void;
  onCancel: () => void;
}

export interface TemplateDetailState extends CredentialTemplate {
  issuedCredentials: Array<{
    id: string;
    holderDid: string;
    status: string;
    issuedAt: string;
  }>;
}
