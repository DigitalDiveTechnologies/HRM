-- Seed deep features (idempotent-ish)

INSERT INTO skills (name, category) VALUES
  ('C# / .NET', 'engineering'),
  ('Flutter', 'engineering'),
  ('HRIS', 'hr'),
  ('UAE Labour Law', 'compliance'),
  ('People Management', 'leadership')
ON CONFLICT (name) DO NOTHING;

INSERT INTO employee_skills (employee_id, skill_id, level)
SELECT e.id, s.id, 'advanced'
FROM employees e CROSS JOIN skills s
WHERE e.emp_code = 'DD-1003' AND s.name = 'Flutter'
AND NOT EXISTS (SELECT 1 FROM employee_skills es WHERE es.employee_id = e.id AND es.skill_id = s.id);

INSERT INTO employee_skills (employee_id, skill_id, level)
SELECT e.id, s.id, 'intermediate'
FROM employees e CROSS JOIN skills s
WHERE e.emp_code = 'DD-1004' AND s.name = 'C# / .NET'
AND NOT EXISTS (SELECT 1 FROM employee_skills es WHERE es.employee_id = e.id AND es.skill_id = s.id);

INSERT INTO employee_skills (employee_id, skill_id, level)
SELECT e.id, s.id, 'expert'
FROM employees e CROSS JOIN skills s
WHERE e.emp_code = 'DD-1001' AND s.name IN ('HRIS', 'UAE Labour Law')
AND NOT EXISTS (SELECT 1 FROM employee_skills es WHERE es.employee_id = e.id AND es.skill_id = s.id);

INSERT INTO employment_history (employee_id, job_title, department_name, manager_name, start_date, end_date, notes)
SELECT e.id, 'Junior Developer', 'Engineering', 'Sara', '2022-06-01', '2023-12-31', 'Promoted to Software Engineer'
FROM employees e WHERE e.emp_code = 'DD-1003'
AND NOT EXISTS (
  SELECT 1 FROM employment_history h WHERE h.employee_id = e.id AND h.job_title = 'Junior Developer' AND h.start_date = '2022-06-01'
);

INSERT INTO employment_history (employee_id, job_title, department_name, manager_name, start_date, end_date, notes)
SELECT e.id, 'Software Engineer', 'Engineering', 'Sara', '2024-01-10', NULL, 'Current role'
FROM employees e WHERE e.emp_code = 'DD-1003'
AND NOT EXISTS (
  SELECT 1 FROM employment_history h WHERE h.employee_id = e.id AND h.job_title = 'Software Engineer' AND h.start_date = '2024-01-10'
);

UPDATE courses SET scheduled_start = CURRENT_DATE + 7, scheduled_end = CURRENT_DATE + 8
WHERE scheduled_start IS NULL AND title ILIKE '%compliance%';

UPDATE courses SET scheduled_start = CURRENT_DATE + 14, scheduled_end = CURRENT_DATE + 16
WHERE scheduled_start IS NULL AND title ILIKE '%security%';

UPDATE courses SET scheduled_start = CURRENT_DATE + 21, scheduled_end = CURRENT_DATE + 22
WHERE scheduled_start IS NULL;

-- Keep employee demo login usable if previously marked exited
UPDATE employees SET status = 'active' WHERE emp_code = 'DD-1003' AND status = 'exited';
