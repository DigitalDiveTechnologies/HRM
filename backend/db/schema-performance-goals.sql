-- Task 3.1: Hierarchical Goal & Key Results (Sub-Goals) Engine
ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS parent_goal_id INT REFERENCES performance_goals(id) ON DELETE CASCADE;
ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS weightage NUMERIC(5,2) DEFAULT 100.00;
ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS target_metric VARCHAR(100);
ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS current_metric VARCHAR(100);
ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS due_date DATE;
CREATE INDEX IF NOT EXISTS idx_perf_goals_parent ON performance_goals(parent_goal_id);
