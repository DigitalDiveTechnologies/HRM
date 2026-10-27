-- Task 5.3: Review Segmentation by Employee Type (Feature #46)
ALTER TABLE performance_templates ADD COLUMN IF NOT EXISTS target_employee_type VARCHAR(50) DEFAULT 'all';
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50);
