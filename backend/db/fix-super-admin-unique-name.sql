-- One display name "Super Admin" only (role code admin). Drop any duplicate-named roles if present.
UPDATE roles SET name = 'Super Admin', description = COALESCE(description, 'Primary Super Admin portal access.')
WHERE code = 'admin';

-- If another role somehow shares the same display name, rename it to keep uniqueness.
UPDATE roles SET name = name || ' (' || code || ')'
WHERE LOWER(TRIM(name)) = 'super admin'
  AND code <> 'admin';

UPDATE users SET
  display_name = 'Super Admin',
  role = 'admin',
  is_active = TRUE,
  role_id = (SELECT id FROM roles WHERE code = 'admin' LIMIT 1)
WHERE LOWER(email) = 'admin@digitaldive.net';

-- Unique role names (case-insensitive). Safe if already unique.
CREATE UNIQUE INDEX IF NOT EXISTS roles_name_lower_uidx ON roles (LOWER(TRIM(name)));
