-- Extra RBAC roles for HR Admin portal assignment (Users portal).
INSERT INTO roles (code, name, description, portal, is_system) VALUES
  ('hr_officer', 'HR Officer', 'HR operations access on the Admin portal.', 'admin', TRUE),
  ('finance', 'Finance', 'Payroll / finance access on the Admin portal.', 'admin', TRUE),
  ('viewer', 'Viewer', 'Read-only access on the Admin portal.', 'admin', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  portal = EXCLUDED.portal;

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'users' AND c.contype = 'c' AND c.conname ILIKE '%role%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', conname);
  END IF;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (LOWER(role) IN (
      'super_admin', 'admin', 'manager', 'employee',
      'hr_officer', 'finance', 'viewer'
    ));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
