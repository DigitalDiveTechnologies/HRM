-- Seed permission rows for Admin portal nav (Overview → Self Service)
-- Employees: only list + create. Designations: Designations + Employment types.

INSERT INTO permissions (code, name, group_code, group_name, parent_code, path, sort_order) VALUES
  -- Overview
  ('dashboard.view', 'Dashboard', 'overview', 'Overview', NULL, '/dashboard', 10),
  ('reports.view', 'Reports & Analytics', 'overview', 'Overview', NULL, '/reports', 20),
  ('ops.view', 'Ops & Scale', 'overview', 'Overview', NULL, '/ops', 30),
  ('notifications.view', 'Notifications', 'overview', 'Overview', NULL, '/notifications', 40),

  -- Core HR — Company
  ('company.create', 'Create Company', 'core_hr', 'Core HR', 'company', '/divisions/management', 100),
  ('company.organisation', 'Organisation', 'core_hr', 'Core HR', 'company', '/divisions/organisation', 110),
  ('company.org.entities', 'Entities', 'core_hr', 'Core HR', 'company.organisation', '/divisions/organisation', 111),
  ('company.org.branches', 'Branches', 'core_hr', 'Core HR', 'company.organisation', '/divisions/organisation', 112),
  ('company.org.positions', 'Positions', 'core_hr', 'Core HR', 'company.organisation', '/divisions/organisation', 113),
  ('company.org.assignments', 'Assignments', 'core_hr', 'Core HR', 'company.organisation', '/divisions/organisation', 114),
  ('company.org.headcount', 'Headcount', 'core_hr', 'Core HR', 'company.organisation', '/divisions/organisation', 115),
  ('company.structure', 'Company Structure', 'core_hr', 'Core HR', 'company', '/divisions/structure', 120),

  -- Employees (only 2)
  ('employees.list', 'Employees', 'core_hr', 'Core HR', 'employees', '/employees', 200),
  ('employees.create', 'Create Employee', 'core_hr', 'Core HR', 'employees', '/employees/create', 210),

  -- Designations & Types (2 tabs)
  ('masters.designations', 'Designations', 'core_hr', 'Core HR', 'masters', '/masters', 300),
  ('masters.employment_types', 'Employment types', 'core_hr', 'Core HR', 'masters', '/masters', 310),

  ('onboarding.view', 'Onboarding', 'core_hr', 'Core HR', NULL, '/onboarding', 400),
  ('recruitment.view', 'Recruitment & ATS', 'core_hr', 'Core HR', NULL, '/recruitment', 410),
  ('exit.view', 'Employee Exit', 'core_hr', 'Core HR', NULL, '/exit', 420),
  ('compliance.view', 'Compliance', 'core_hr', 'Core HR', NULL, '/compliance', 430),
  ('performance.view', 'Performance', 'core_hr', 'Core HR', NULL, '/performance', 440),
  ('training.view', 'Training', 'core_hr', 'Core HR', NULL, '/training', 450),
  ('assets.view', 'Assets', 'core_hr', 'Core HR', NULL, '/assets', 460),
  ('travel.view', 'Travel & Expense', 'core_hr', 'Core HR', NULL, '/travel', 470),
  ('attendance.view', 'Attendance', 'core_hr', 'Core HR', NULL, '/attendance', 480),
  ('leave.view', 'Leave', 'core_hr', 'Core HR', NULL, '/leave', 490),
  ('certificates.view', 'Certificates', 'core_hr', 'Core HR', NULL, '/certificates', 500),
  ('payroll.view', 'Payroll', 'core_hr', 'Core HR', NULL, '/payroll', 510),
  ('approvals.view', 'Approvals', 'core_hr', 'Core HR', NULL, '/approvals', 520),

  -- Self Service
  ('ess.view', 'ESS Portal', 'self_service', 'Self Service', NULL, '/ess', 600),
  ('mss.view', 'MSS Portal', 'self_service', 'Self Service', NULL, '/mss', 610),
  ('documents.view', 'Documents', 'self_service', 'Self Service', NULL, '/documents', 620)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  group_code = EXCLUDED.group_code,
  group_name = EXCLUDED.group_name,
  parent_code = EXCLUDED.parent_code,
  path = EXCLUDED.path,
  sort_order = EXCLUDED.sort_order;

-- Default grants = previous hardcoded nav roles (do not wipe custom grants if already set)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.code) = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'notifications.view', 'performance.view', 'training.view', 'travel.view',
  'attendance.view', 'leave.view', 'certificates.view', 'approvals.view',
  'ess.view', 'mss.view', 'documents.view'
)
WHERE LOWER(r.code) = 'manager'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'notifications.view', 'performance.view', 'training.view', 'travel.view',
  'attendance.view', 'leave.view', 'certificates.view',
  'ess.view', 'documents.view'
)
WHERE LOWER(r.code) = 'employee'
ON CONFLICT DO NOTHING;

-- HR Officer / Finance / Viewer: start with admin-equivalent so portal stays usable until Super Admin tunes matrix
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.code) IN ('hr_officer', 'finance', 'viewer')
ON CONFLICT DO NOTHING;
