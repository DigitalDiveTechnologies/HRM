-- =============================================================================
-- Synergy HRM - Task 2.4: Dynamic Custom Fields & Attributes (JSONB Engine)
-- =============================================================================

CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id SERIAL PRIMARY KEY,
    tab_group VARCHAR(50) NOT NULL DEFAULT 'custom',
    field_key VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL, -- 'text', 'number', 'date', 'select'
    options_json JSONB,             -- e.g. ["Small", "Medium", "Large"]
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cf_tab_order ON custom_field_definitions(tab_group, sort_order) WHERE is_active = TRUE;

-- Seed default initial custom fields
INSERT INTO custom_field_definitions (tab_group, field_key, label, field_type, options_json, is_required, sort_order, is_active)
VALUES
  ('marine_ops', 'sea_crew_id', 'Sea Crew ID', 'text', NULL, FALSE, 1, TRUE),
  ('uniform_gear', 'uniform_size', 'Uniform Size', 'select', '["XS", "S", "M", "L", "XL", "2XL", "3XL"]'::jsonb, FALSE, 2, TRUE),
  ('certifications', 'offshore_clearance', 'Offshore Security Clearance', 'select', '["Valid", "Pending Renewal", "Exempt", "Not Applicable"]'::jsonb, FALSE, 3, TRUE),
  ('general', 'emergency_contact_relation', 'Emergency Contact Relationship', 'text', NULL, FALSE, 4, TRUE),
  ('certifications', 'clearance_expiry_date', 'Offshore Clearance Expiry', 'date', NULL, FALSE, 5, TRUE)
ON CONFLICT (field_key) DO NOTHING;
