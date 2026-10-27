-- Task 5.2: Direct Appraisal & Goal Evidence File Uploads (Feature #39)
ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS file_ref TEXT;
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS file_ref TEXT;
