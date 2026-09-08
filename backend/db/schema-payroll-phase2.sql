-- Phase 2 completion — control transitions, settlement, GPSSA/Emiratisation, renewals
-- Safe / idempotent

-- Allow multiple runs per period only when prior is reversed
ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_period_uq;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_runs_open_period
  ON payroll_runs (period_year, period_month, COALESCE(legal_entity_id, 0))
  WHERE status NOT IN ('reversed');

CREATE TABLE IF NOT EXISTS payroll_run_events (
  id SERIAL PRIMARY KEY,
  payroll_run_id INT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_email TEXT,
  actor_role TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_run_events_run ON payroll_run_events(payroll_run_id);

ALTER TABLE payroll_run_lines
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_days NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gpssa_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gpssa_employer NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emp_code TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS is_emirati BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pension_authority TEXT,
  ADD COLUMN IF NOT EXISTS pension_contribution_salary NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS nafis_registered BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS exit_settlements (
  id SERIAL PRIMARY KEY,
  exit_case_id INT NOT NULL UNIQUE REFERENCES exit_cases(id) ON DELETE CASCADE,
  employee_id INT NOT NULL REFERENCES employees(id),
  eosb_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  unused_leave_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notice_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  unpaid_absence_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_settlement NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_years NUMERIC(8,2) NOT NULL DEFAULT 0,
  unpaid_leave_days NUMERIC(10,2) NOT NULL DEFAULT 0,
  rule_code TEXT,
  formula_version TEXT,
  jurisdiction_profile TEXT,
  breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_preview BOOLEAN NOT NULL DEFAULT TRUE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculated_by_email TEXT
);

CREATE TABLE IF NOT EXISTS document_renewal_tasks (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_id INT REFERENCES documents(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date DATE,
  owner_role TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT document_renewal_status_chk CHECK (status IN ('open','in_progress','done','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_doc_renewal_due ON document_renewal_tasks(due_date) WHERE status IN ('open','in_progress');
CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_renewal_open_doc
  ON document_renewal_tasks (document_id)
  WHERE document_id IS NOT NULL AND status IN ('open','in_progress');
