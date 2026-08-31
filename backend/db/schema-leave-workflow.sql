-- Phase 5 — manager → HR leave approval workflow

ALTER TABLE approvals ADD COLUMN IF NOT EXISTS decision_note TEXT;

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS manager_note TEXT;
