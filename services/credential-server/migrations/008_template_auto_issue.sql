ALTER TABLE templates
ADD COLUMN IF NOT EXISTS is_auto_issue BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_single_auto_issue_per_issuer
  ON templates(issuer_id)
  WHERE is_auto_issue = TRUE;
