ALTER TABLE issuer_users DROP CONSTRAINT IF EXISTS issuer_users_role_check;

ALTER TABLE issuer_users
ADD CONSTRAINT issuer_users_role_check
CHECK (role IN ('admin', 'operator', 'viewer', 'verifier'));
