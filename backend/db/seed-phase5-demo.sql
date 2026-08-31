-- Phase 5 demo: Ahmed Khan (DD-1004) as team lead with app login; team reports to him.

UPDATE employees
SET job_title = 'Team Lead'
WHERE emp_code = 'DD-1004';

UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'DD-1004' LIMIT 1)
WHERE emp_code IN ('DD-1003', 'DD-1005', 'DD-1006');

INSERT INTO users (email, password, role, employee_id)
SELECT 'ahmed@digitaldive.demo', 'demo123', 'employee', e.id
FROM employees e
WHERE e.emp_code = 'DD-1004'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.email) = 'ahmed@digitaldive.demo');
