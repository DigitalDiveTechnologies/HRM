-- RBAC: roles table (source of truth — no hardcoded portal roles in UI)
-- Keeps existing users.role string for JWT / [Authorize(Roles=...)] compatibility.

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  portal TEXT NOT NULL CHECK (portal IN ('users', 'admin', 'employee')),
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INT REFERENCES roles(id);

INSERT INTO roles (code, name, description, portal, is_system) VALUES
  ('super_admin', 'Super Admin', 'Manages users and role assignments in the Users portal.', 'users', TRUE),
  ('admin', 'Admin (HR)', 'Full HR Admin portal access.', 'admin', TRUE),
  ('manager', 'Manager', 'Manager / MSS access on Admin portal.', 'admin', TRUE),
  ('employee', 'Employee', 'Employee self-service portal access.', 'employee', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  portal = EXCLUDED.portal;

-- Link existing users.role → roles.id (safe; does not change role strings)
UPDATE users u
SET role_id = r.id
FROM roles r
WHERE LOWER(u.role) = LOWER(r.code)
  AND (u.role_id IS NULL OR u.role_id <> r.id);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- Allow super_admin in existing CHECK (if present)
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

