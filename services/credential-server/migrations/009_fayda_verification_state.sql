CREATE TABLE IF NOT EXISTS issuer_fayda_verifications (
  id UUID PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES issuers(id) ON DELETE CASCADE,
  holder_aid TEXT NOT NULL,
  fayda_id TEXT NOT NULL,
  template_id UUID NULL REFERENCES templates(id) ON DELETE SET NULL,
  credential_id TEXT NULL,
  status VARCHAR(64) NOT NULL CHECK (
    status IN ('verified', 'pending_manual_review', 'credential_issued')
  ),
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  mapped_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  fayda_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(issuer_id, holder_aid)
);

CREATE INDEX IF NOT EXISTS idx_issuer_fayda_verifications_holder
  ON issuer_fayda_verifications(issuer_id, holder_aid);

CREATE INDEX IF NOT EXISTS idx_issuer_fayda_verifications_fayda_id
  ON issuer_fayda_verifications(issuer_id, fayda_id);
