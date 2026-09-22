-- Ensure Super Admin + Sara (admin) exist and are active on Admin portal
UPDATE roles
SET portal = 'admin',
    description = 'Full access + Settings (Users, Roles, Permissions) on the HR Admin portal.'
WHERE LOWER(code) = 'super_admin';

INSERT INTO roles (code, name, description, portal, is_system) VALUES
  ('super_admin', 'Super Admin', 'Full access + Settings on HR Admin portal.', 'admin', TRUE),
  ('admin', 'Admin (HR)', 'Full HR Admin portal access.', 'admin', TRUE),
  ('manager', 'Manager', 'Manager access', 'admin', TRUE),
  ('hr_officer', 'HR Officer', 'HR operations', 'admin', TRUE),
  ('finance', 'Finance', 'Finance access', 'admin', TRUE),
  ('viewer', 'Viewer', 'Read-only access', 'admin', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  portal = EXCLUDED.portal;

INSERT INTO users (email, password, role, employee_id, display_name, is_active, role_id)
SELECT 'superadmin@digitaldive.demo', 'demo123', 'super_admin', NULL, 'Super Admin', TRUE, r.id
FROM roles r WHERE r.code = 'super_admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password, role, employee_id, display_name, is_active, role_id)
SELECT 'admin@digitaldive.demo', 'demo123', 'admin', NULL, 'Sara', TRUE, r.id
FROM roles r WHERE r.code = 'admin'
ON CONFLICT (email) DO NOTHING;

UPDATE users SET
  is_active = TRUE,
  display_name = COALESCE(NULLIF(display_name, ''), 'Super Admin'),
  role = 'super_admin',
  role_id = (SELECT id FROM roles WHERE code = 'super_admin' LIMIT 1)
WHERE LOWER(email) = 'superadmin@digitaldive.demo';

UPDATE users SET
  is_active = TRUE,
  display_name = COALESCE(NULLIF(display_name, ''), 'Sara'),
  role = 'admin',
  role_id = (SELECT id FROM roles WHERE code = 'admin' LIMIT 1)
WHERE LOWER(email) = 'admin@digitaldive.demo';
