-- Remove " Al Maktoum" suffix from display names (idempotent).
UPDATE employees
SET full_name = TRIM(REPLACE(full_name, ' Al Maktoum', ''))
WHERE full_name LIKE '% Al Maktoum%';

UPDATE performance_reviews
SET reviewer_name = TRIM(REPLACE(reviewer_name, ' Al Maktoum', ''))
WHERE reviewer_name LIKE '% Al Maktoum%';

UPDATE employment_history
SET manager_name = TRIM(REPLACE(manager_name, ' Al Maktoum', ''))
WHERE manager_name LIKE '% Al Maktoum%';
