CREATE TABLE IF NOT EXISTS schema_registry (
  schema_id VARCHAR(255) PRIMARY KEY,
  owner_issuer_id UUID NULL REFERENCES issuers(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_registry_owner_public
  ON schema_registry(owner_issuer_id, is_public);

INSERT INTO schema_registry(
  schema_id,
  owner_issuer_id,
  is_public,
  created_at,
  updated_at
)
VALUES(
  'EHYYZFJas0_cgo3nA1_BeeyWRIzyWqic3pM-LdYmL_R6',
  NULL,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT(schema_id)
DO UPDATE SET
  is_public = TRUE,
  updated_at = NOW();
