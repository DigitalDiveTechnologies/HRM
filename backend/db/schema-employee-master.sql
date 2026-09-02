-- Extended employee master fields (SAP-style tabs) stored as JSONB.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS master_data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_employees_master_data ON employees USING gin (master_data);
