CREATE TABLE IF NOT EXISTS issuer_application_requests (
  id UUID PRIMARY KEY,
  organization_name TEXT NOT NULL,
  organization_type TEXT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NULL,
  country TEXT NULL,
  website TEXT NULL,
  credential_use_case TEXT NOT NULL,
  expected_volume TEXT NULL,
  notes TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMP NULL,
  reviewed_by UUID NULL REFERENCES issuer_users(id) ON DELETE SET NULL,
  admin_note TEXT NULL,
  provisioned_user_id UUID NULL REFERENCES issuer_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issuer_application_requests_status_created
  ON issuer_application_requests(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_issuer_application_requests_pending_email
  ON issuer_application_requests(LOWER(email))
  WHERE status = 'pending';
