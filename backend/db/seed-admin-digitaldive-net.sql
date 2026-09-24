-- Protected primary Super Admin (admin@digitaldive.net). Password demo123 — first login may BCrypt-upgrade.
-- Role code stays `admin`; display name is Super Admin (unique — no second role with same name).
INSERT INTO roles (code, name, description, portal, is_system) VALUES
  ('admin', 'Super Admin', 'Primary Super Admin portal access.', 'admin', TRUE)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, portal = 'admin', description = EXCLUDED.description;

INSERT INTO users (email, password, role, employee_id, display_name, is_active, role_id)
SELECT
  'admin@digitaldive.net',
  'demo123',
  'admin',
  NULL,
  'Super Admin',
  TRUE,
  r.id
FROM roles r
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE LOWER(u.email) = 'admin@digitaldive.net'
  );

-- Keep existing primary account aligned (idempotent).
UPDATE roles SET name = 'Super Admin', description = 'Primary Super Admin portal access.'
WHERE code = 'admin';

UPDATE users SET
  display_name = 'Super Admin',
  role = 'admin',
  is_active = TRUE,
  role_id = (SELECT id FROM roles WHERE code = 'admin' LIMIT 1)
WHERE LOWER(email) = 'admin@digitaldive.net';
