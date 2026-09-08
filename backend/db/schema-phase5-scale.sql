-- Phase 5 (Blueprint Scale) — ops resilience, config, job runs, notifications DDL

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT,
  due_date DATE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_emp ON notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read) WHERE is_read = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe
  ON notifications (employee_id, category, due_date, title);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS job_runs (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  detail TEXT,
  actor_email TEXT,
  CONSTRAINT job_runs_status_chk CHECK (status IN ('running','succeeded','failed'))
);

CREATE INDEX IF NOT EXISTS idx_job_runs_started ON job_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS report_exports (
  id SERIAL PRIMARY KEY,
  report_key TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'csv',
  row_count INT NOT NULL DEFAULT 0,
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_exports_created ON report_exports(created_at DESC);

-- Default tenant / support config keys
INSERT INTO system_config (key, value, description) VALUES
  ('org.display_name', 'GOCs HR', 'Portal organisation display name'),
  ('ops.alert_window_days', '60', 'Default expiry alert window (days) for visa/passport/EID'),
  ('ops.notifications_auto', 'manual', 'Notification generation mode: manual | scheduled'),
  ('analytics.currency', 'AED', 'Default analytics currency label'),
  ('support.contact_email', 'hr@gocs.demo', 'Support contact shown in ops tooling')
ON CONFLICT (key) DO NOTHING;
