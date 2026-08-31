-- Phase 3: designation & employment type masters + employee FKs

CREATE TABLE IF NOT EXISTS designations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT designations_status_chk CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS employment_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employment_types_status_chk CHECK (status IN ('active', 'inactive'))
);

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS designation_id INT REFERENCES designations(id);

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employment_type_id INT REFERENCES employment_types(id);

CREATE INDEX IF NOT EXISTS idx_employees_designation_id ON employees(designation_id);
CREATE INDEX IF NOT EXISTS idx_employees_employment_type_id ON employees(employment_type_id);
