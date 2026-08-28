-- Digital Dive HR — deep feature extensions (safe IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS employment_history (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  department_name TEXT,
  manager_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'general'
);

CREATE TABLE IF NOT EXISTS employee_skills (
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'intermediate',
  PRIMARY KEY (employee_id, skill_id)
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS scheduled_start DATE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS scheduled_end DATE;

CREATE TABLE IF NOT EXISTS approval_chains (
  request_type TEXT NOT NULL,
  level_no INT NOT NULL,
  approver_role TEXT NOT NULL,
  PRIMARY KEY (request_type, level_no)
);

INSERT INTO approval_chains (request_type, level_no, approver_role) VALUES
  ('leave', 1, 'manager'),
  ('leave', 2, 'admin'),
  ('travel', 1, 'manager'),
  ('expense', 1, 'manager'),
  ('exit', 1, 'manager'),
  ('exit', 2, 'admin')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INT,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exit_cases ADD COLUMN IF NOT EXISTS eosb_amount NUMERIC(12,2);
ALTER TABLE exit_cases ADD COLUMN IF NOT EXISTS service_years NUMERIC(6,2);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_auto
  ON notifications (employee_id, category, due_date, title)
  WHERE employee_id IS NOT NULL AND due_date IS NOT NULL;
