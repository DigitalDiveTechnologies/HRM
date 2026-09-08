-- Phase 2 preview scaffolding — payroll control layer (Blueprint v1.1)
-- Configurable; bank-specific SIF fields filled later from Phase 0 / sir input.
-- Safe IF NOT EXISTS

CREATE TABLE IF NOT EXISTS payroll_runs (
  id SERIAL PRIMARY KEY,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  legal_entity_id INT REFERENCES legal_entities(id),
  status TEXT NOT NULL DEFAULT 'draft',
  label TEXT,
  is_preview BOOLEAN NOT NULL DEFAULT TRUE,
  calculated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  reversed_run_id INT REFERENCES payroll_runs(id),
  created_by_email TEXT,
  approved_by_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_runs_month_chk CHECK (period_month BETWEEN 1 AND 12),
  CONSTRAINT payroll_runs_status_chk CHECK (
    status IN ('draft','calculated','reviewed','approved','paid','reversed','closed')
  ),
  CONSTRAINT payroll_runs_period_uq UNIQUE (period_year, period_month, legal_entity_id)
);

CREATE TABLE IF NOT EXISTS payroll_run_lines (
  id SERIAL PRIMARY KEY,
  payroll_run_id INT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id INT NOT NULL REFERENCES employees(id),
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  unpaid_leave_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  net NUMERIC(12,2) NOT NULL DEFAULT 0,
  iban TEXT,
  mol_id TEXT,
  payment_method TEXT,
  wps_ready BOOLEAN NOT NULL DEFAULT FALSE,
  validation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_run ON payroll_run_lines(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_emp ON payroll_run_lines(employee_id);

-- Employer / bank config placeholders (sir fills later)
CREATE TABLE IF NOT EXISTS payroll_employer_config (
  id SERIAL PRIMARY KEY,
  legal_entity_id INT NOT NULL REFERENCES legal_entities(id),
  bank_or_exchange_name TEXT,
  sif_spec_version TEXT,
  wps_employer_unique_id TEXT,
  mohre_establishment_no TEXT,
  sif_field_map_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_preview BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_employer_config_open
  ON payroll_employer_config (legal_entity_id)
  WHERE effective_to IS NULL;

-- Versioned EOSB rule profiles (mainland default; DIFC/DEWS later)
CREATE TABLE IF NOT EXISTS eosb_rule_versions (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  jurisdiction_profile TEXT NOT NULL DEFAULT 'uae_mainland',
  formula_version TEXT NOT NULL,
  description TEXT,
  first_years INT NOT NULL DEFAULT 5,
  days_per_year_first NUMERIC(6,2) NOT NULL DEFAULT 21,
  days_per_year_after NUMERIC(6,2) NOT NULL DEFAULT 30,
  use_basic_salary_only BOOLEAN NOT NULL DEFAULT TRUE,
  deduct_unpaid_leave BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO eosb_rule_versions (code, jurisdiction_profile, formula_version, description)
VALUES (
  'UAE_MAINLAND_V1_PREVIEW',
  'uae_mainland',
  'v1-preview',
  'Mainland expat gratuity preview 21/30 day bands. Unpaid leave deduction flag on. Not production-certified until specialist sign-off.'
)
ON CONFLICT (code) DO NOTHING;

-- Seed empty employer config for GOCS entity if present
INSERT INTO payroll_employer_config (legal_entity_id, bank_or_exchange_name, sif_spec_version, is_preview)
SELECT le.id, NULL, 'PENDING_SIR_SPEC', TRUE
FROM legal_entities le
WHERE le.code = 'GOCS'
  AND NOT EXISTS (
    SELECT 1 FROM payroll_employer_config c
    WHERE c.legal_entity_id = le.id AND c.effective_to IS NULL
  );
