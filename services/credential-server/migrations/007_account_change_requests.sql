CREATE TABLE IF NOT EXISTS account_change_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES issuer_users(id) ON DELETE CASCADE,
  issuer_id UUID NOT NULL REFERENCES issuers(id) ON DELETE CASCADE,
  field_name VARCHAR(64) NOT NULL CHECK (field_name IN ('issuer_name', 'email')),
  current_value TEXT NOT NULL DEFAULT '',
  requested_value TEXT NOT NULL,
  reason TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID NULL REFERENCES issuer_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP NULL,
  admin_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_change_requests_user_status
  ON account_change_requests(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_change_requests_status_created
  ON account_change_requests(status, created_at DESC);
