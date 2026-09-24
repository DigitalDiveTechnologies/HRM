-- Protected Admin login (not .demo). Password demo123 — first login may BCrypt-upgrade.
INSERT INTO roles (code, name, description, portal, is_system) VALUES
  ('admin', 'Admin', 'HR Admin portal access.', 'admin', TRUE)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, portal = 'admin';

INSERT INTO users (email, password, role, employee_id, display_name, is_active, role_id)
SELECT
  'admin@digitaldive.net',
  'demo123',
  'admin',
  NULL,
  'Admin',
  TRUE,
  r.id
FROM roles r
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE LOWER(u.email) = 'admin@digitaldive.net'
  );
