interface CredentialIssueRequest {
  schemaSaid: string;
  aid: string;
  attribute?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

export type { CredentialIssueRequest };
