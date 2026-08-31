-- Phase 6 demo: one pending certificate request for Fatima
INSERT INTO certificate_requests (
  employee_id, certificate_type, purpose, bank_name, status,
  emp_code, full_name, designation, department, division, basic_salary, join_date
)
SELECT
  e.id,
  'salary',
  'Personal bank verification',
  NULL,
  'pending',
  e.emp_code,
  e.full_name,
  COALESCE(dg.name, e.job_title),
  d.name,
  dv.name,
  e.basic_salary,
  e.join_date
FROM employees e
LEFT JOIN departments d ON d.id = e.department_id
LEFT JOIN divisions dv ON dv.id = e.division_id
LEFT JOIN designations dg ON dg.id = e.designation_id
WHERE LOWER(e.email) = 'fatima@digitaldive.demo'
  AND NOT EXISTS (
    SELECT 1 FROM certificate_requests cr
    WHERE cr.employee_id = e.id AND cr.certificate_type = 'salary' AND cr.status = 'pending'
  )
LIMIT 1;
