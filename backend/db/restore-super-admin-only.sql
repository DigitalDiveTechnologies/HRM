-- Restore master Super Admin login only (not managed Users/Roles).
-- Safe to re-run. Does not recreate Sara Admin or custom roles.

INSERT INTO roles (code, name, description, portal, is_system) VALUES
  ('super_admin', 'Super Admin', 'Master portal operator — not listed in Settings → Users.', 'admin', TRUE),
  ('employee', 'Employee', 'Employee self-service portal access.', 'employee', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (email, password, role, employee_id, display_name, is_active, role_id)
SELECT
  'superadmin@digitaldive.demo',
  'demo123',
  'super_admin',
  NULL,
  'Super Admin',
  TRUE,
  r.id
FROM roles r
WHERE r.code = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE LOWER(u.email) = 'superadmin@digitaldive.demo'
  );

-- If row exists but was deactivated / role stripped, repair master key only
UPDATE users u
SET
  role = 'super_admin',
  is_active = TRUE,
  display_name = COALESCE(NULLIF(u.display_name, ''), 'Super Admin'),
  role_id = (SELECT id FROM roles WHERE code = 'super_admin' LIMIT 1)
WHERE LOWER(u.email) = 'superadmin@digitaldive.demo';
