-- RBAC permissions catalog + role grants (Admin portal Settings matrix)
-- Safe / idempotent.

-- Super Admin lives on Admin portal (Settings), not a separate Users portal
UPDATE roles
SET portal = 'admin',
    description = 'Full access + Settings (Users, Roles, Permissions) on the HR Admin portal.'
WHERE LOWER(code) = 'super_admin';

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  group_code TEXT NOT NULL,
  group_name TEXT NOT NULL,
  parent_code TEXT,
  path TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_group ON permissions (group_code, sort_order);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id);
