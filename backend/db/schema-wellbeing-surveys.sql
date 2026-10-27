-- Migration: schema-wellbeing-surveys.sql
-- Chat 4: Employee Wellbeing & eNPS Pulse Survey Engine

CREATE TABLE IF NOT EXISTS wellbeing_surveys (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    questions_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wellbeing_survey_responses (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL REFERENCES wellbeing_surveys(id) ON DELETE CASCADE,
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    nps_score INT CHECK (nps_score >= 0 AND nps_score <= 10),
    answers_json JSONB NOT NULL,
    feedback_text TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wellbeing_surveys_active ON wellbeing_surveys(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wellbeing_responses_survey ON wellbeing_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_responses_dept ON wellbeing_survey_responses(department_id);
