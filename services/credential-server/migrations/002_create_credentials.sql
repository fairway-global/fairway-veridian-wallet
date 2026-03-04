CREATE TABLE credentials (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES templates(id),
  schema_id VARCHAR(255) NOT NULL,
  holder_did VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('issued', 'revoked', 'deleted')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credentials_template_id ON credentials(template_id);
CREATE INDEX idx_credentials_holder_did ON credentials(holder_did);
CREATE INDEX idx_credentials_status ON credentials(status);
