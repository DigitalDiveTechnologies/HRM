-- Migration: schema-company-events.sql
-- Chat 4: Corporate Social Events & RSVP Management

CREATE TABLE IF NOT EXISTS company_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    location VARCHAR(200) NOT NULL,
    max_attendees INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_event_rsvps (
    event_id INT NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'attending', -- 'attending', 'declined', 'maybe'
    responded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_company_events_date ON company_events(event_date ASC);
CREATE INDEX IF NOT EXISTS idx_company_event_rsvps_event ON company_event_rsvps(event_id);
