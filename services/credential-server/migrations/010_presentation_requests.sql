CREATE TABLE IF NOT EXISTS presentation_requests (
  id UUID PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES issuers(id) ON DELETE CASCADE,
  request_exn_said TEXT NOT NULL UNIQUE,
  verifier_did TEXT NOT NULL,
  holder_did TEXT NOT NULL,
  schema_id TEXT NOT NULL,
  requested_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(64) NOT NULL CHECK (
    status IN ('requested', 'verified', 'completed', 'rejected', 'failed')
  ),
  offer_exn_said TEXT NULL,
  agree_exn_said TEXT NULL,
  grant_exn_said TEXT NULL,
  presented_credential_id TEXT NULL,
  presented_issuer_did TEXT NULL,
  presented_holder_did TEXT NULL,
  presented_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  presented_at TIMESTAMP NULL,
  verified_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presentation_requests_issuer_requested_at
  ON presentation_requests(issuer_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_presentation_requests_issuer_holder
  ON presentation_requests(issuer_id, holder_did);

CREATE INDEX IF NOT EXISTS idx_presentation_requests_issuer_status
  ON presentation_requests(issuer_id, status);

CREATE INDEX IF NOT EXISTS idx_presentation_requests_issuer_request_exn
  ON presentation_requests(issuer_id, request_exn_said);

CREATE INDEX IF NOT EXISTS idx_presentation_requests_issuer_agree_exn
  ON presentation_requests(issuer_id, agree_exn_said);
