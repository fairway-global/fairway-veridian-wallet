WITH schema_usage AS (
  SELECT schema_id, issuer_id
  FROM templates
  WHERE schema_id IS NOT NULL

  UNION

  SELECT schema_id, issuer_id
  FROM credentials
  WHERE schema_id IS NOT NULL

  UNION

  SELECT schema_id, issuer_id
  FROM presentation_requests
  WHERE schema_id IS NOT NULL
),
single_issuer_schemas AS (
  SELECT
    schema_id,
    MIN(issuer_id::text)::uuid AS owner_issuer_id
  FROM schema_usage
  GROUP BY schema_id
  HAVING COUNT(DISTINCT issuer_id) = 1
)
INSERT INTO schema_registry(
  schema_id,
  owner_issuer_id,
  is_public,
  created_at,
  updated_at
)
SELECT
  single_issuer_schemas.schema_id,
  single_issuer_schemas.owner_issuer_id,
  FALSE,
  NOW(),
  NOW()
FROM single_issuer_schemas
LEFT JOIN schema_registry
  ON schema_registry.schema_id = single_issuer_schemas.schema_id
WHERE schema_registry.schema_id IS NULL;
