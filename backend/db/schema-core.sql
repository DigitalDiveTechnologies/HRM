-- =============================================================================
-- Core base tables for Digital Dive / GOCs HR System
-- =============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  manager_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS divisions (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  payroll_type TEXT NOT NULL DEFAULT 'wps',
  status TEXT NOT NULL DEFAULT 'active',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT divisions_payroll_type_chk CHECK (payroll_type IN ('wps', 'bank_transfer')),
  CONSTRAINT divisions_status_chk CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS divisions_name_lower_uidx
  ON divisions (LOWER(TRIM(name)));

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

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  emp_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  division_id INT REFERENCES divisions(id) ON DELETE SET NULL,
  designation_id INT REFERENCES designations(id) ON DELETE SET NULL,
  employment_type_id INT REFERENCES employment_types(id) ON DELETE SET NULL,
  job_title TEXT,
  join_date DATE,
  dob DATE,
  nationality TEXT,
  passport_no TEXT,
  passport_expiry DATE,
  emirates_id TEXT,
  emirates_id_expiry DATE,
  visa_no TEXT,
  visa_expiry DATE,
  contract_end DATE,
  probation_end DATE,
  status TEXT NOT NULL DEFAULT 'active',
  manager_id INT REFERENCES employees(id) ON DELETE SET NULL,
  in_hr_ops BOOLEAN NOT NULL DEFAULT TRUE,
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  photo_path TEXT,
  photo_content_sha256 TEXT,
  is_emirati BOOLEAN NOT NULL DEFAULT FALSE,
  pension_authority TEXT,
  pension_contribution_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  nafis_registered BOOLEAN NOT NULL DEFAULT FALSE,
  master_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_division ON employees(division_id);
CREATE INDEX IF NOT EXISTS idx_employees_designation ON employees(designation_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_in_ops ON employees(in_hr_ops);
CREATE INDEX IF NOT EXISTS idx_employees_master_data ON employees USING gin (master_data);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  role_id INT,
  preferred_locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  shift_name TEXT DEFAULT 'General',
  overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  late_minutes INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, work_date DESC);

CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC(5,1) NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  balance_after NUMERIC(5,1),
  manager_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

CREATE TABLE IF NOT EXISTS approvals (
  id SERIAL PRIMARY KEY,
  request_type TEXT NOT NULL,
  reference_id INT NOT NULL,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT,
  level_no INT NOT NULL DEFAULT 1,
  approver_role TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'pending',
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_ref ON approvals(request_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_approvals_emp ON approvals(employee_id);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_ref TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'valid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_emp ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);

CREATE TABLE IF NOT EXISTS payslips (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  wps_ref TEXT,
  payment_method TEXT NOT NULL DEFAULT 'bank',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payslips_emp ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_period ON payslips(period_label);
