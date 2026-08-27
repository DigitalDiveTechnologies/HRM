-- Digital Dive HR — Phase 0 schema extensions (100% product modules)
-- Safe to re-run (IF NOT EXISTS). Does not drop existing demo tables.

-- ========== Phase 1: Recruitment / ATS ==========
CREATE TABLE IF NOT EXISTS job_postings (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT DEFAULT 'Dubai, UAE',
  employment_type TEXT DEFAULT 'Full-time',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'on_hold')),
  opened_at DATE DEFAULT CURRENT_DATE,
  closed_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  job_id INT REFERENCES job_postings(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_ref TEXT,
  source TEXT DEFAULT 'Careers page',
  stage TEXT NOT NULL DEFAULT 'applied'
    CHECK (stage IN ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interviews (
  id SERIAL PRIMARY KEY,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  interviewer TEXT,
  mode TEXT DEFAULT 'Online',
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  salary NUMERIC(12,2),
  currency TEXT DEFAULT 'AED',
  join_date DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'withdrawn')),
  letter_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== Phase 1: Exit ==========
CREATE TABLE IF NOT EXISTS exit_cases (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  exit_type TEXT NOT NULL DEFAULT 'resignation'
    CHECK (exit_type IN ('resignation', 'termination', 'end_of_contract', 'other')),
  reason TEXT,
  notice_date DATE,
  last_working_date DATE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  settlement_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exit_checklist (
  id SERIAL PRIMARY KEY,
  exit_case_id INT NOT NULL REFERENCES exit_cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'clearance',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'waived')),
  completed_at TIMESTAMPTZ
);

-- ========== Phase 1: Compliance ==========
CREATE TABLE IF NOT EXISTS compliance_items (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'document'
    CHECK (category IN ('labor_law', 'visa', 'document', 'audit', 'other')),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'due_soon', 'overdue', 'compliant', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== Phase 2: Performance ==========
CREATE TABLE IF NOT EXISTS performance_goals (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kpi TEXT,
  target_value TEXT,
  progress_pct NUMERIC(5,2) DEFAULT 0,
  period_label TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_name TEXT,
  review_type TEXT DEFAULT 'annual'
    CHECK (review_type IN ('annual', 'mid_year', 'probation', '360')),
  rating NUMERIC(3,1),
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  review_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== Phase 2: Training ==========
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  duration_hours NUMERIC(5,1) DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_at DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
  completed_at DATE,
  UNIQUE (course_id, employee_id)
);

CREATE TABLE IF NOT EXISTS certifications (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT,
  issued_on DATE,
  expires_on DATE,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'revoked'))
);

-- ========== Phase 3: Assets ==========
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  asset_tag TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'laptop'
    CHECK (category IN ('laptop', 'phone', 'access_card', 'other')),
  serial_no TEXT,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'assigned', 'retired', 'lost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_assignments (
  id SERIAL PRIMARY KEY,
  asset_id INT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_at DATE DEFAULT CURRENT_DATE,
  returned_at DATE,
  notes TEXT
);

-- ========== Phase 3: Travel & Expense ==========
CREATE TABLE IF NOT EXISTS travel_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  purpose TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_cost NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'AED',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_claims (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'AED',
  expense_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_job ON candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_stage ON candidates(stage);
CREATE INDEX IF NOT EXISTS idx_exit_cases_employee ON exit_cases(employee_id);
CREATE INDEX IF NOT EXISTS idx_compliance_due ON compliance_items(due_date);
CREATE INDEX IF NOT EXISTS idx_goals_employee ON performance_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_employee ON course_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
