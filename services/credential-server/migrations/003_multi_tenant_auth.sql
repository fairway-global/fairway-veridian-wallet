CREATE TABLE IF NOT EXISTS issuers (
  id UUID PRIMARY KEY,
  code VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issuer_signify_accounts (
  issuer_id UUID PRIMARY KEY REFERENCES issuers(id) ON DELETE CASCADE,
  bran_encrypted TEXT NOT NULL,
  aid_alias VARCHAR(255) NOT NULL,
  aid_prefix VARCHAR(255),
  registry_regk VARCHAR(255),
  qvi_credential_id VARCHAR(255),
  initialized_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issuer_users (
  id UUID PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES issuers(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(issuer_id, email)
);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES issuer_users(id) ON DELETE CASCADE,
  issuer_id UUID NOT NULL REFERENCES issuers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  replaced_by UUID NULL REFERENCES auth_refresh_tokens(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gateway_token_jti (
  jti VARCHAR(255) PRIMARY KEY,
  issuer_id UUID NOT NULL REFERENCES issuers(id) ON DELETE CASCADE,
  scope VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE templates ADD COLUMN IF NOT EXISTS issuer_id UUID;
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS issuer_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'templates'
  ) THEN
    BEGIN
      ALTER TABLE templates
      ADD CONSTRAINT templates_issuer_fk
      FOREIGN KEY (issuer_id) REFERENCES issuers(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'credentials'
  ) THEN
    BEGIN
      ALTER TABLE credentials
      ADD CONSTRAINT credentials_issuer_fk
      FOREIGN KEY (issuer_id) REFERENCES issuers(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_templates_issuer_schema
  ON templates(issuer_id, schema_id);

CREATE INDEX IF NOT EXISTS idx_credentials_issuer_status_holder
  ON credentials(issuer_id, status, holder_did);

