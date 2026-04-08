CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES issuer_users(id) ON DELETE CASCADE,
  issuer_id UUID NOT NULL REFERENCES issuers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_user
  ON auth_password_reset_tokens(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_expiry
  ON auth_password_reset_tokens(expires_at);
