-- Synergy HRM branding migration.
-- Run once against the existing database after deploying the updated API.

INSERT INTO system_config (key, value, description) VALUES
  ('org.display_name', 'Synergy', 'All Companies sidebar brand name'),
  ('org.logo_url', '/media/synergy-logo.png', 'All Companies sidebar logo (data URL or path)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
