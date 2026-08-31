-- Seed designation & employment type masters (idempotent)

INSERT INTO designations (name, status) VALUES
  ('Software Engineer', 'active'),
  ('HR Executive', 'active'),
  ('Team Lead', 'active'),
  ('Office Boy', 'active'),
  ('Finance Officer', 'active'),
  ('Operations Manager', 'active')
ON CONFLICT (name) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO employment_types (name, status) VALUES
  ('Full-time', 'active'),
  ('Part-time', 'active'),
  ('Contract', 'active'),
  ('Probation', 'active')
ON CONFLICT (name) DO UPDATE SET status = EXCLUDED.status;

-- Link existing employees by matching job_title text where possible
UPDATE employees e
SET designation_id = d.id
FROM designations d
WHERE e.designation_id IS NULL
  AND LOWER(TRIM(e.job_title)) = LOWER(TRIM(d.name));

UPDATE employees e
SET employment_type_id = et.id
FROM employment_types et
WHERE e.employment_type_id IS NULL
  AND et.name = 'Full-time';
