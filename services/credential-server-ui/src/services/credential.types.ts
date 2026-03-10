interface CredentialIssueRequest {
  schemaSaid: string;
  aid: string;
  attribute?: Record<string, string>;
  attributes?: Record<string, string>;
}

export type { CredentialIssueRequest };
