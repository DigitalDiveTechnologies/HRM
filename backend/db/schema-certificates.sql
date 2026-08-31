-- Phase 6: Employee certificate requests (Bank, Salary, NOC Travel)
-- Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS certificate_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  certificate_type TEXT NOT NULL
    CHECK (certificate_type IN ('bank', 'salary', 'noc_travel')),
  purpose TEXT,
  bank_name TEXT,
  travel_destination TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'issued')),
  -- Snapshot at request time (auto-filled from profile)
  emp_code TEXT,
  full_name TEXT,
  designation TEXT,
  department TEXT,
  division TEXT,
  basic_salary NUMERIC(12,2),
  join_date DATE,
  hr_note TEXT,
  file_ref TEXT,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificate_requests_employee ON certificate_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_certificate_requests_status ON certificate_requests (status);
