-- Seed sample data for new modules (idempotent-ish: only inserts if empty)

INSERT INTO job_postings (title, department, location, employment_type, description, status)
SELECT 'Software Engineer', 'Engineering', 'Dubai, UAE', 'Full-time',
       'Build HR portal features with .NET and Flutter.', 'open'
WHERE NOT EXISTS (SELECT 1 FROM job_postings LIMIT 1);

INSERT INTO job_postings (title, department, location, employment_type, description, status)
SELECT 'HR Executive', 'Human Resources', 'Dubai, UAE', 'Full-time',
       'Own onboarding, compliance follow-ups, and employee relations.', 'open'
WHERE (SELECT COUNT(*) FROM job_postings) < 2;

INSERT INTO candidates (job_id, full_name, email, phone, stage, source, notes)
SELECT j.id, 'Aisha Khan', 'aisha.khan@example.com', '+971500000101', 'screening', 'LinkedIn', 'Strong Flutter portfolio'
FROM job_postings j WHERE j.title = 'Software Engineer'
AND NOT EXISTS (SELECT 1 FROM candidates WHERE email = 'aisha.khan@example.com');

INSERT INTO candidates (job_id, full_name, email, phone, stage, source, notes)
SELECT j.id, 'Bilal Ahmed', 'bilal.ahmed@example.com', '+971500000102', 'interview', 'Referral', '5y HR ops experience'
FROM job_postings j WHERE j.title = 'HR Executive'
AND NOT EXISTS (SELECT 1 FROM candidates WHERE email = 'bilal.ahmed@example.com');

INSERT INTO candidates (job_id, full_name, email, phone, stage, source)
SELECT j.id, 'Chen Wei', 'chen.wei@example.com', '+971500000103', 'applied', 'Careers page'
FROM job_postings j WHERE j.title = 'Software Engineer'
AND NOT EXISTS (SELECT 1 FROM candidates WHERE email = 'chen.wei@example.com');

INSERT INTO interviews (candidate_id, scheduled_at, interviewer, mode, status)
SELECT c.id, NOW() + INTERVAL '3 days', 'Sara', 'Online', 'scheduled'
FROM candidates c WHERE c.email = 'bilal.ahmed@example.com'
AND NOT EXISTS (SELECT 1 FROM interviews i WHERE i.candidate_id = c.id);

INSERT INTO offers (candidate_id, salary, currency, join_date, status, letter_ref)
SELECT c.id, 14000, 'AED', CURRENT_DATE + INTERVAL '30 days', 'draft', 'OFFER-DRAFT-001'
FROM candidates c WHERE c.email = 'aisha.khan@example.com'
AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.candidate_id = c.id);

INSERT INTO courses (title, category, duration_hours, description, status)
SELECT 'UAE Labour Law Essentials', 'Compliance', 4, 'Core labour law for HR ops.', 'active'
WHERE NOT EXISTS (SELECT 1 FROM courses LIMIT 1);

INSERT INTO courses (title, category, duration_hours, description, status)
SELECT 'Flutter Attendance & Biometrics', 'Engineering', 6, 'Mobile attendance patterns.', 'active'
WHERE (SELECT COUNT(*) FROM courses) < 2;

INSERT INTO assets (asset_tag, name, category, serial_no, status)
SELECT 'DD-LT-001', 'MacBook Pro 14', 'laptop', 'SN-MBP-001', 'available'
WHERE NOT EXISTS (SELECT 1 FROM assets LIMIT 1);

INSERT INTO assets (asset_tag, name, category, serial_no, status)
SELECT 'DD-PH-001', 'iPhone 15', 'phone', 'SN-IP-001', 'available'
WHERE (SELECT COUNT(*) FROM assets) < 2;

INSERT INTO compliance_items (employee_id, title, category, due_date, status, notes)
SELECT e.id, 'Emirates ID renewal', 'document', e.emirates_id_expiry, 'due_soon',
       'Renew before expiry; upload copy to Documents.'
FROM employees e WHERE e.emp_code = 'DD-1003'
AND NOT EXISTS (SELECT 1 FROM compliance_items WHERE title = 'Emirates ID renewal' AND employee_id = e.id);

INSERT INTO compliance_items (employee_id, title, category, due_date, status, notes)
SELECT e.id, 'Residence visa follow-up', 'visa', e.visa_expiry, 'open',
       'Coordinate with PRO for renewal window.'
FROM employees e WHERE e.emp_code = 'DD-1004'
AND NOT EXISTS (SELECT 1 FROM compliance_items WHERE title = 'Residence visa follow-up' AND employee_id = e.id);

INSERT INTO compliance_items (employee_id, title, category, due_date, status, notes)
SELECT e.id, 'Labour contract amendment', 'labor_law', CURRENT_DATE + INTERVAL '45 days', 'open',
       'Update salary clause after appraisal.'
FROM employees e WHERE e.emp_code = 'DD-1001'
AND NOT EXISTS (SELECT 1 FROM compliance_items WHERE title = 'Labour contract amendment' AND employee_id = e.id);

INSERT INTO compliance_items (employee_id, title, category, due_date, status, notes)
SELECT NULL, 'Q3 internal HR audit checklist', 'audit', CURRENT_DATE + INTERVAL '20 days', 'due_soon',
       'Payroll, leave balances, and WPS file samples.'
WHERE NOT EXISTS (SELECT 1 FROM compliance_items WHERE title = 'Q3 internal HR audit checklist');

INSERT INTO compliance_items (employee_id, title, category, due_date, status, notes)
SELECT e.id, 'Passport copy on file', 'document', e.passport_expiry, 'compliant',
       'Verified against HR file.'
FROM employees e WHERE e.emp_code = 'DD-1004'
AND NOT EXISTS (SELECT 1 FROM compliance_items WHERE title = 'Passport copy on file' AND employee_id = e.id);

INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status)
SELECT e.id, 'Ship attendance biometric release', 'Feature delivery', '1 production release', 70, 'H2 2026', 'active'
FROM employees e WHERE e.emp_code = 'DD-1003'
AND NOT EXISTS (SELECT 1 FROM performance_goals WHERE title = 'Ship attendance biometric release' AND employee_id = e.id);

INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status)
SELECT e.id, 'Reduce leave approval turnaround', 'Avg days to approve', '< 2 days', 45, 'Q3 2026', 'active'
FROM employees e WHERE e.emp_code = 'DD-1001'
AND NOT EXISTS (SELECT 1 FROM performance_goals WHERE title = 'Reduce leave approval turnaround' AND employee_id = e.id);

INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status)
SELECT e.id, 'Mentor 2 junior engineers', 'Mentorship', '2 mentees', 100, 'H1 2026', 'completed'
FROM employees e WHERE e.emp_code = 'DD-1004'
AND NOT EXISTS (SELECT 1 FROM performance_goals WHERE title = 'Mentor 2 junior engineers' AND employee_id = e.id);

INSERT INTO performance_reviews (employee_id, reviewer_name, review_type, rating, summary, status, review_date)
SELECT e.id, 'Sara', 'mid_year', 4.2, 'Strong delivery; continue focus on documentation.', 'submitted', CURRENT_DATE - INTERVAL '10 days'
FROM employees e WHERE e.emp_code = 'DD-1003'
AND NOT EXISTS (
  SELECT 1 FROM performance_reviews r WHERE r.employee_id = e.id AND r.review_type = 'mid_year' AND r.reviewer_name = 'Sara'
);

INSERT INTO performance_reviews (employee_id, reviewer_name, review_type, rating, summary, status, review_date)
SELECT e.id, 'Sara', 'annual', 4.5, 'Strong operations leadership.', 'draft', CURRENT_DATE
FROM employees e WHERE e.emp_code = 'DD-1004'
AND NOT EXISTS (
  SELECT 1 FROM performance_reviews r WHERE r.employee_id = e.id AND r.review_type = 'annual' AND r.status = 'draft'
);

INSERT INTO course_enrollments (course_id, employee_id, due_date, status)
SELECT c.id, e.id, CURRENT_DATE + INTERVAL '30 days', 'in_progress'
FROM courses c
CROSS JOIN employees e
WHERE c.title = 'UAE Labour Law Essentials' AND e.emp_code = 'DD-1001'
AND NOT EXISTS (SELECT 1 FROM course_enrollments WHERE course_id = c.id AND employee_id = e.id);

INSERT INTO course_enrollments (course_id, employee_id, due_date, status)
SELECT c.id, e.id, CURRENT_DATE + INTERVAL '45 days', 'assigned'
FROM courses c
CROSS JOIN employees e
WHERE c.title = 'Flutter Attendance & Biometrics' AND e.emp_code = 'DD-1003'
AND NOT EXISTS (SELECT 1 FROM course_enrollments WHERE course_id = c.id AND employee_id = e.id);

INSERT INTO course_enrollments (course_id, employee_id, due_date, status, completed_at)
SELECT c.id, e.id, CURRENT_DATE - INTERVAL '5 days', 'completed', CURRENT_DATE - INTERVAL '7 days'
FROM courses c
CROSS JOIN employees e
WHERE c.title = 'UAE Labour Law Essentials' AND e.emp_code = 'DD-1004'
AND NOT EXISTS (SELECT 1 FROM course_enrollments WHERE course_id = c.id AND employee_id = e.id);

INSERT INTO certifications (employee_id, name, issuer, issued_on, expires_on, status)
SELECT e.id, 'PMP', 'PMI', '2024-06-01', '2027-06-01', 'valid'
FROM employees e WHERE e.emp_code = 'DD-1004'
AND NOT EXISTS (SELECT 1 FROM certifications WHERE employee_id = e.id AND name = 'PMP');

INSERT INTO certifications (employee_id, name, issuer, issued_on, expires_on, status)
SELECT e.id, 'AWS Cloud Practitioner', 'Amazon', '2023-01-15', '2026-01-15', 'valid'
FROM employees e WHERE e.emp_code = 'DD-1003'
AND NOT EXISTS (SELECT 1 FROM certifications WHERE employee_id = e.id AND name = 'AWS Cloud Practitioner');

INSERT INTO asset_assignments (asset_id, employee_id, notes)
SELECT a.id, e.id, 'Primary work laptop'
FROM assets a
CROSS JOIN employees e
WHERE a.asset_tag = 'DD-LT-001' AND e.emp_code = 'DD-1003'
AND NOT EXISTS (SELECT 1 FROM asset_assignments WHERE asset_id = a.id AND returned_at IS NULL);

UPDATE assets SET status = 'assigned'
WHERE asset_tag = 'DD-LT-001'
  AND EXISTS (
    SELECT 1 FROM asset_assignments aa
    WHERE aa.asset_id = assets.id AND aa.returned_at IS NULL
  );

INSERT INTO travel_requests (employee_id, destination, purpose, start_date, end_date, estimated_cost, currency, status)
SELECT e.id, 'Abu Dhabi', 'Client workshop', CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '16 days', 1200, 'AED', 'pending'
FROM employees e WHERE e.emp_code = 'DD-1004'
AND NOT EXISTS (SELECT 1 FROM travel_requests WHERE employee_id = e.id AND destination = 'Abu Dhabi');

INSERT INTO travel_requests (employee_id, destination, purpose, start_date, end_date, estimated_cost, currency, status)
SELECT e.id, 'Riyadh', 'Partner meetup', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '18 days', 3500, 'AED', 'approved'
FROM employees e WHERE e.emp_code = 'DD-1001'
AND NOT EXISTS (SELECT 1 FROM travel_requests WHERE employee_id = e.id AND destination = 'Riyadh');

INSERT INTO expense_claims (employee_id, title, category, amount, currency, expense_date, status, notes)
SELECT e.id, 'Taxi to airport', 'travel', 85, 'AED', CURRENT_DATE - INTERVAL '2 days', 'pending', 'Receipt attached in Documents'
FROM employees e WHERE e.emp_code = 'DD-1003'
AND NOT EXISTS (SELECT 1 FROM expense_claims WHERE employee_id = e.id AND title = 'Taxi to airport');

INSERT INTO expense_claims (employee_id, title, category, amount, currency, expense_date, status, notes)
SELECT e.id, 'Team lunch client visit', 'meals', 420, 'AED', CURRENT_DATE - INTERVAL '10 days', 'approved', NULL
FROM employees e WHERE e.emp_code = 'DD-1004'
AND NOT EXISTS (SELECT 1 FROM expense_claims WHERE employee_id = e.id AND title = 'Team lunch client visit');
