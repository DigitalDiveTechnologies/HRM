-- Company name unique; clear business company codes (keep internal unique NOT NULL codes).
-- All Companies brand keys + permission.

UPDATE divisions SET code = 'C' || id::text;

CREATE UNIQUE INDEX IF NOT EXISTS divisions_name_lower_uidx
  ON divisions (LOWER(TRIM(name)));

INSERT INTO system_config (key, value, description) VALUES
  ('org.display_name', 'GOCs', 'All Companies sidebar brand name'),
  ('org.logo_url', '', 'All Companies sidebar logo (data URL or path)')
ON CONFLICT (key) DO NOTHING;

-- Keep display name default aligned with sidebar if empty/legacy
UPDATE system_config
SET value = 'GOCs', description = COALESCE(description, 'All Companies sidebar brand name')
WHERE key = 'org.display_name' AND (value IS NULL OR TRIM(value) = '' OR value = 'GOCs HR');

INSERT INTO permissions (code, name, group_code, group_name, parent_code, path, sort_order) VALUES
  ('company.brand.edit', 'Edit All Companies Brand', 'core_hr', 'Core HR', 'company', '/dashboard', 101)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  group_code = EXCLUDED.group_code,
  group_name = EXCLUDED.group_name,
  parent_code = EXCLUDED.parent_code,
  path = EXCLUDED.path,
  sort_order = EXCLUDED.sort_order;

-- Grant new permission to admin (and any future re-seed)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.code) = 'admin'
  AND p.code = 'company.brand.edit'
ON CONFLICT DO NOTHING;
