-- Post-patch checks (raises if demo policy violated).
DO $$
DECLARE
  user_count INT;
  emp_count INT;
  bad_emp INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  IF user_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 users, found %', user_count;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = 'admin@digitaldive.demo') THEN
    RAISE EXCEPTION 'admin@digitaldive.demo missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = 'fatima@digitaldive.demo') THEN
    RAISE EXCEPTION 'fatima@digitaldive.demo missing';
  END IF;

  SELECT COUNT(*) INTO bad_emp FROM employees WHERE emp_code IN ('DD-1000', 'DD-1002');
  IF bad_emp > 0 THEN
    RAISE EXCEPTION 'Removed employees still present: %', bad_emp;
  END IF;

  SELECT COUNT(*) INTO emp_count FROM employees WHERE in_hr_ops = TRUE AND status != 'exited';
  IF emp_count <> 5 THEN
    RAISE EXCEPTION 'Expected 5 active HR employees, found %', emp_count;
  END IF;
END $$;
