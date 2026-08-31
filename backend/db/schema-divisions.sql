-- Phase 2: GOCs company divisions (soft-delete via status = inactive)

CREATE TABLE IF NOT EXISTS divisions (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  payroll_type TEXT NOT NULL DEFAULT 'wps',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT divisions_payroll_type_chk CHECK (payroll_type IN ('wps', 'bank_transfer')),
  CONSTRAINT divisions_status_chk CHECK (status IN ('active', 'inactive'))
);

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS division_id INT REFERENCES divisions(id);

CREATE INDEX IF NOT EXISTS idx_employees_division_id ON employees(division_id);
