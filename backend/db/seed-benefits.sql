-- Seed demo benefit plans and employee enrollments (DEV only – idempotent)

-- 1. Insert benefit plans
INSERT INTO benefit_plans (name, benefit_type, provider_name, policy_number, coverage_summary, annual_premium_employer, annual_premium_employee, is_active)
VALUES
  (
    'Daman Enhanced Gold',
    'medical_insurance',
    'Daman National Health Insurance',
    'DAM-2026-GOLD-001',
    'Comprehensive inpatient & outpatient cover. Includes dental, optical and specialist visits. Network: All UAE hospitals. Annual limit: AED 500,000.',
    5800.00, 0.00, TRUE
  ),
  (
    'AXA Silver Plus',
    'medical_insurance',
    'AXA Gulf Insurance',
    'AXA-2026-SILV-007',
    'Enhanced basic cover with outpatient and emergency care. GP, specialist, and pharmacy covered. Network: 300+ UAE clinics. Annual limit: AED 150,000.',
    3200.00, 800.00, TRUE
  ),
  (
    'Group Life & AD&D',
    'life_insurance',
    'MetLife UAE',
    'MET-2026-LIFE-002',
    '3x annual salary life insurance + accidental death & dismemberment. Automatic enrollment for all full-time staff. No medical underwriting required.',
    1200.00, 0.00, TRUE
  )
ON CONFLICT DO NOTHING;

-- 2. Assign benefit plans to DEV employees (safe, uses ON CONFLICT DO NOTHING via unique index if it exists)
-- Daman Gold → employees 1, 3
INSERT INTO employee_benefits (employee_id, benefit_plan_id, member_id, coverage_tier, dependents_count, start_date, end_date, status)
SELECT
  e.id,
  bp.id,
  CASE e.id
    WHEN 1 THEN 'DAM-8810001'
    WHEN 3 THEN 'DAM-8810003'
  END,
  'employee_only',
  0,
  '2026-01-01',
  '2026-12-31',
  'active'
FROM employees e, benefit_plans bp
WHERE e.id IN (1, 3)
  AND bp.policy_number = 'DAM-2026-GOLD-001'
  AND NOT EXISTS (
    SELECT 1 FROM employee_benefits eb2
    WHERE eb2.employee_id = e.id AND eb2.benefit_plan_id = bp.id
  );

-- AXA Silver → employees 4, 5, 6 (family tier)
INSERT INTO employee_benefits (employee_id, benefit_plan_id, member_id, coverage_tier, dependents_count, start_date, end_date, status)
SELECT
  e.id,
  bp.id,
  'AXA-' || LPAD(e.id::text, 7, '0'),
  'family',
  2,
  '2026-01-01',
  '2026-12-31',
  'active'
FROM employees e, benefit_plans bp
WHERE e.id IN (4, 5, 6)
  AND bp.policy_number = 'AXA-2026-SILV-007'
  AND NOT EXISTS (
    SELECT 1 FROM employee_benefits eb2
    WHERE eb2.employee_id = e.id AND eb2.benefit_plan_id = bp.id
  );

-- Life insurance → all employees
INSERT INTO employee_benefits (employee_id, benefit_plan_id, member_id, coverage_tier, dependents_count, start_date, end_date, status)
SELECT
  e.id,
  bp.id,
  'MET-' || LPAD(e.id::text, 7, '0'),
  'employee_only',
  0,
  '2026-01-01',
  '2026-12-31',
  'active'
FROM employees e, benefit_plans bp
WHERE e.id IN (1, 3, 4, 5, 6)
  AND bp.policy_number = 'MET-2026-LIFE-002'
  AND NOT EXISTS (
    SELECT 1 FROM employee_benefits eb2
    WHERE eb2.employee_id = e.id AND eb2.benefit_plan_id = bp.id
  );
