-- Blueprint v1.1 Phase 1 — Organisation foundation (legal entity → position → assignment)
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS legal_entities (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  trade_licence TEXT,
  mohre_establishment_no TEXT,
  wps_employer_id TEXT,
  emirate TEXT,
  free_zone_authority TEXT,
  jurisdiction_profile TEXT NOT NULL DEFAULT 'uae_mainland',
  bank_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT legal_entities_status_chk CHECK (status IN ('active', 'inactive')),
  CONSTRAINT legal_entities_jurisdiction_chk CHECK (
    jurisdiction_profile IN ('uae_mainland', 'free_zone', 'difc', 'adgm', 'other')
  )
);

CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  legal_entity_id INT NOT NULL REFERENCES legal_entities(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  emirate TEXT,
  is_remote BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT branches_status_chk CHECK (status IN ('active', 'inactive')),
  CONSTRAINT branches_entity_code_uq UNIQUE (legal_entity_id, code)
);

CREATE INDEX IF NOT EXISTS idx_branches_entity ON branches(legal_entity_id);

ALTER TABLE designations ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE designations ADD COLUMN IF NOT EXISTS job_family TEXT;
ALTER TABLE designations ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE designations ADD COLUMN IF NOT EXISTS skill_level TEXT;
ALTER TABLE designations ADD COLUMN IF NOT EXISTS default_reporting_designation_id INT REFERENCES designations(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_designations_code
  ON designations (code) WHERE code IS NOT NULL AND code <> '';

ALTER TABLE departments ADD COLUMN IF NOT EXISTS legal_entity_id INT REFERENCES legal_entities(id);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES branches(id);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS cost_centre TEXT;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE divisions ADD COLUMN IF NOT EXISTS legal_entity_id INT REFERENCES legal_entities(id);
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS cost_centre_code TEXT;

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  legal_entity_id INT NOT NULL REFERENCES legal_entities(id),
  branch_id INT REFERENCES branches(id),
  department_id INT REFERENCES departments(id),
  division_id INT REFERENCES divisions(id),
  designation_id INT REFERENCES designations(id),
  title TEXT NOT NULL,
  reports_to_position_id INT REFERENCES positions(id),
  budget_min NUMERIC(12,2),
  budget_max NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'vacant',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT positions_status_chk CHECK (status IN ('approved', 'vacant', 'occupied', 'frozen')),
  CONSTRAINT positions_no_self_report CHECK (reports_to_position_id IS NULL OR reports_to_position_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_positions_entity ON positions(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_positions_reports_to ON positions(reports_to_position_id);
CREATE INDEX IF NOT EXISTS idx_positions_department ON positions(department_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);

CREATE TABLE IF NOT EXISTS position_assignments (
  id SERIAL PRIMARY KEY,
  position_id INT NOT NULL REFERENCES positions(id),
  employee_id INT NOT NULL REFERENCES employees(id),
  assignment_type TEXT NOT NULL DEFAULT 'primary',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  temporary_manager_employee_id INT REFERENCES employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT position_assignments_type_chk CHECK (
    assignment_type IN ('primary', 'acting', 'temporary', 'secondary')
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_assign_employee ON position_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_pos_assign_position ON position_assignments(position_id);
CREATE INDEX IF NOT EXISTS idx_pos_assign_open
  ON position_assignments(employee_id)
  WHERE effective_to IS NULL AND is_primary = TRUE;

-- Default legal entity for migration (GOCs demo)
INSERT INTO legal_entities (code, name, emirate, jurisdiction_profile, status)
VALUES ('GOCS', 'GOCs Global', 'Dubai', 'uae_mainland', 'active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO branches (legal_entity_id, code, name, emirate, status)
SELECT le.id, 'DXB-HQ', 'Dubai HQ', 'Dubai', 'active'
FROM legal_entities le
WHERE le.code = 'GOCS'
  AND NOT EXISTS (
    SELECT 1 FROM branches b WHERE b.legal_entity_id = le.id AND b.code = 'DXB-HQ'
  );

-- Effective reporting manager: temp override → position incumbent → legacy manager_id
CREATE OR REPLACE VIEW v_employee_reporting_manager AS
SELECT
  e.id AS employee_id,
  COALESCE(
    pa_self.temporary_manager_employee_id,
    pa_mgr.employee_id,
    e.manager_id
  ) AS manager_employee_id
FROM employees e
LEFT JOIN position_assignments pa_self
  ON pa_self.employee_id = e.id
 AND pa_self.is_primary = TRUE
 AND pa_self.effective_to IS NULL
LEFT JOIN positions pos ON pos.id = pa_self.position_id
LEFT JOIN position_assignments pa_mgr
  ON pa_mgr.position_id = pos.reports_to_position_id
 AND pa_mgr.is_primary = TRUE
 AND pa_mgr.effective_to IS NULL;
