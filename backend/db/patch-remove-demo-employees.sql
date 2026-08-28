-- Remove boss (Muhammad Faisal / DD-1000) and manager (Omar Hassan / DD-1002).
-- Keeps admin + fatima logins and 5 HR-visible employees (Sara, Fatima, Ahmed, Layla, Yusuf).

DELETE FROM users
WHERE LOWER(email) IN ('boss@digitaldive.demo', 'omar@digitaldive.demo');

-- Reassign reports before delete (Fatima & Yusuf were under Omar; Sara was under CEO).
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'DD-1001' LIMIT 1)
WHERE emp_code IN ('DD-1003', 'DD-1006');

UPDATE employees
SET manager_id = NULL
WHERE emp_code = 'DD-1001';

UPDATE departments
SET manager_name = 'Sara'
WHERE manager_name IN ('Omar Hassan', 'Muhammad Faisal');

UPDATE employment_history
SET manager_name = 'Sara'
WHERE manager_name = 'Omar Hassan';

UPDATE interviews
SET interviewer = 'Sara'
WHERE interviewer = 'Omar Hassan';

DELETE FROM notifications
WHERE employee_id IN (SELECT id FROM employees WHERE emp_code IN ('DD-1000', 'DD-1002'));

DELETE FROM approvals
WHERE employee_id IN (SELECT id FROM employees WHERE emp_code IN ('DD-1000', 'DD-1002'));

DELETE FROM employees
WHERE emp_code IN ('DD-1000', 'DD-1002');
