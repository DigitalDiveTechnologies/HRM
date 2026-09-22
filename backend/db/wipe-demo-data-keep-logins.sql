-- Wipe operational HR data for fresh Admin portal testing.
-- KEEP logins + passwords:
--   superadmin@digitaldive.demo
--   admin@digitaldive.demo
--   fatima@digitaldive.demo (+ Fatima employee row)
-- KEEP: roles (RBAC).

BEGIN;

-- Detach admin/super_admin from employee rows we will delete
UPDATE users
SET employee_id = NULL
WHERE LOWER(email) IN ('admin@digitaldive.demo', 'superadmin@digitaldive.demo');

-- Drop every other login — Fatima / admin / superadmin stay (passwords untouched)
DELETE FROM users
WHERE LOWER(email) NOT IN (
  'superadmin@digitaldive.demo',
  'admin@digitaldive.demo',
  'fatima@digitaldive.demo'
);

-- Clear transactional / module data
TRUNCATE TABLE
  approval_chains,
  approvals,
  asset_assignments,
  assets,
  attendance,
  audit_logs,
  candidates,
  certificate_requests,
  certifications,
  compliance_items,
  course_enrollments,
  courses,
  document_renewal_tasks,
  documents,
  employee_skills,
  employment_history,
  eosb_rule_versions,
  exit_checklist,
  exit_settlements,
  exit_cases,
  expense_claims,
  interviews,
  offers,
  job_postings,
  job_runs,
  leave_requests,
  notifications,
  onboarding_tasks,
  payroll_employer_config,
  payroll_run_events,
  payroll_run_lines,
  payroll_runs,
  payslips,
  performance_goals,
  performance_reviews,
  position_assignments,
  report_exports,
  skills,
  system_config,
  travel_requests
RESTART IDENTITY CASCADE;

-- Detach ALL employees from org masters before truncating companies/structure
UPDATE employees SET manager_id = NULL;
UPDATE employees SET division_id = NULL WHERE TRUE;
UPDATE employees SET department_id = NULL WHERE TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'designation_id'
  ) THEN
    EXECUTE 'UPDATE employees SET designation_id = NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'employment_type_id'
  ) THEN
    EXECUTE 'UPDATE employees SET employment_type_id = NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'legal_entity_id'
  ) THEN
    EXECUTE 'UPDATE employees SET legal_entity_id = NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'branch_id'
  ) THEN
    EXECUTE 'UPDATE employees SET branch_id = NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'position_id'
  ) THEN
    EXECUTE 'UPDATE employees SET position_id = NULL';
  END IF;
END $$;

-- Org / company structure (empty for fresh test).
-- IMPORTANT: do NOT use CASCADE here — it would wipe employees/users via FKs.
TRUNCATE TABLE
  positions,
  branches,
  legal_entities,
  divisions,
  departments,
  designations,
  employment_types
RESTART IDENTITY;

-- Employees: keep only Fatima (linked to kept login)
DELETE FROM employees
WHERE id NOT IN (
  SELECT employee_id FROM users
  WHERE LOWER(email) = 'fatima@digitaldive.demo'
    AND employee_id IS NOT NULL
);

-- Ensure kept users remain active (passwords not modified)
UPDATE users
SET is_active = TRUE
WHERE LOWER(email) IN (
  'superadmin@digitaldive.demo',
  'admin@digitaldive.demo',
  'fatima@digitaldive.demo'
);

COMMIT;
