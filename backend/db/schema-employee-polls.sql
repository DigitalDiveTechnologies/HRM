-- Migration: schema-employee-polls.sql
-- Chat 4: Interactive Employee Pulse Polls & Real-Time Voting

CREATE TABLE IF NOT EXISTS employee_polls (
    id SERIAL PRIMARY KEY,
    question VARCHAR(300) NOT NULL,
    options_json JSONB NOT NULL, -- [{"id": 1, "text": "Option A"}, ...]
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INT REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_poll_votes (
    poll_id INT NOT NULL REFERENCES employee_polls(id) ON DELETE CASCADE,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    selected_option_id INT NOT NULL,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poll_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_polls_active ON employee_polls(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_poll_votes_poll ON employee_poll_votes(poll_id);
