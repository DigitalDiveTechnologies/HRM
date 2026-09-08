-- Phase 4 — onboarding device/checklist tasks (matches portal UI)
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Laptop',
  tag_no TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  signed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy table may already exist with fewer columns — bring it up to date
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Laptop';
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS tag_no TEXT;
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE onboarding_tasks SET title = COALESCE(NULLIF(title, ''), 'Onboarding task') WHERE title IS NULL;
UPDATE onboarding_tasks SET category = COALESCE(NULLIF(category, ''), 'Laptop') WHERE category IS NULL;
UPDATE onboarding_tasks SET status = COALESCE(NULLIF(status, ''), 'pending') WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_tasks_status_chk'
  ) THEN
    ALTER TABLE onboarding_tasks
      ADD CONSTRAINT onboarding_tasks_status_chk
      CHECK (status IN ('pending','in_progress','done','cancelled'));
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- keep apply idempotent if legacy statuses exist
END $$;

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_emp ON onboarding_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_status ON onboarding_tasks(status);

-- Seed a few pending handovers for active employees if they have no tasks yet
INSERT INTO onboarding_tasks (employee_id, title, category, tag_no, due_date, status)
SELECT e.id,
       'Laptop handover — ' || COALESCE(e.emp_code, e.id::text),
       'Laptop',
       'OB-' || e.id || '-LT',
       CURRENT_DATE + 7,
       'pending'
FROM employees e
WHERE e.in_hr_ops = TRUE AND e.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM onboarding_tasks t WHERE t.employee_id = e.id)
LIMIT 5;
