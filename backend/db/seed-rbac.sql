-- Seed Super Admin for Users portal (plaintext OK — first login upgrades to BCrypt).
-- Does not modify existing admin / employee accounts.

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
