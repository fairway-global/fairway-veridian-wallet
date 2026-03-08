ALTER TABLE issuer_users DROP CONSTRAINT IF EXISTS issuer_users_role_check;

ALTER TABLE issuer_users
ADD CONSTRAINT issuer_users_role_check
CHECK (role IN ('admin', 'operator', 'viewer', 'verifier', 'issuer'));

UPDATE issuer_users
SET role = CASE role
  WHEN 'operator' THEN 'issuer'
  WHEN 'viewer' THEN 'verifier'
  ELSE role
END
WHERE role IN ('operator', 'viewer');

ALTER TABLE issuer_users DROP CONSTRAINT IF EXISTS issuer_users_role_check;

ALTER TABLE issuer_users
ADD CONSTRAINT issuer_users_role_check
CHECK (role IN ('admin', 'issuer', 'verifier'));
