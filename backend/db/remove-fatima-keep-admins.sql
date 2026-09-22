-- Remove Fatima employee + login. Keep only admin + super_admin.

BEGIN;

UPDATE users SET employee_id = NULL WHERE LOWER(email) = 'fatima@digitaldive.demo';

DELETE FROM users WHERE LOWER(email) = 'fatima@digitaldive.demo';

DELETE FROM employees
WHERE LOWER(email) = 'fatima@digitaldive.demo'
   OR id NOT IN (
     SELECT employee_id FROM users WHERE employee_id IS NOT NULL
   );

-- Safety: no orphan employees
DELETE FROM employees
WHERE id NOT IN (SELECT employee_id FROM users WHERE employee_id IS NOT NULL);

COMMIT;
