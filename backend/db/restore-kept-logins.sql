-- Restore kept portal logins after wipe (passwords demo123 — first login may BCrypt-upgrade).
-- Roles already present from RBAC seed.

BEGIN;

INSERT INTO roles (code, name, description, portal, is_system) VALUES
  ('super_admin', 'Super Admin', 'Manages users and role assignments in the Users portal.', 'users', TRUE),
  ('admin', 'Admin (HR)', 'Full HR Admin portal access.', 'admin', TRUE),
  ('manager', 'Manager', 'Manager / MSS access on Admin portal.', 'admin', TRUE),
  ('employee', 'Employee', 'Employee self-service portal access.', 'employee', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Minimal Fatima employee for ESS login link
INSERT INTO employees (full_name, email, status, emp_code)
SELECT 'Fatima Noor', 'fatima@digitaldive.demo', 'active', 'DD-FATIMA'
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE LOWER(email) = 'fatima@digitaldive.demo'
);

-- Prefer existing emp_code pattern if table requires more NOT NULL columns — fill safely
DO $$
DECLARE
  fatima_emp_id INT;
BEGIN
  SELECT id INTO fatima_emp_id FROM employees WHERE LOWER(email) = 'fatima@digitaldive.demo' LIMIT 1;

  INSERT INTO users (email, password, role, employee_id, display_name, is_active, role_id)
  SELECT 'superadmin@digitaldive.demo', 'demo123', 'super_admin', NULL, 'Super Admin', TRUE, r.id
  FROM roles r WHERE r.code = 'super_admin'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.email) = 'superadmin@digitaldive.demo');

  INSERT INTO users (email, password, role, employee_id, display_name, is_active, role_id)
  SELECT 'admin@digitaldive.demo', 'demo123', 'admin', NULL, 'Sara', TRUE, r.id
  FROM roles r WHERE r.code = 'admin'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.email) = 'admin@digitaldive.demo');

  INSERT INTO users (email, password, role, employee_id, display_name, is_active, role_id)
  SELECT 'fatima@digitaldive.demo', 'demo123', 'employee', fatima_emp_id, 'Fatima Noor', TRUE, r.id
  FROM roles r WHERE r.code = 'employee'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.email) = 'fatima@digitaldive.demo');

  -- If Fatima user existed without employee link, attach
  UPDATE users
  SET employee_id = fatima_emp_id,
      role = 'employee',
      is_active = TRUE
  WHERE LOWER(email) = 'fatima@digitaldive.demo'
    AND (employee_id IS NULL OR employee_id <> fatima_emp_id);
END $$;

COMMIT;
