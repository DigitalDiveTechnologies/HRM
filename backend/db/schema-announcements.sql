-- Company Announcements & Read Receipts Schema (Zero Regression, Additive Only)

CREATE TABLE IF NOT EXISTS company_announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    category VARCHAR(64) DEFAULT 'General',
    priority VARCHAR(32) DEFAULT 'normal',
    audience_type VARCHAR(32) DEFAULT 'all',
    division_id INT REFERENCES divisions(id) ON DELETE SET NULL,
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    requires_ack BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    author_email VARCHAR(255),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_announcements_published ON company_announcements(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_announcements_audience ON company_announcements(audience_type, division_id, department_id);

CREATE TABLE IF NOT EXISTS announcement_acks (
    id SERIAL PRIMARY KEY,
    announcement_id INT NOT NULL REFERENCES company_announcements(id) ON DELETE CASCADE,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(64),
    CONSTRAINT uq_announcement_ack UNIQUE (announcement_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_acks_ann_emp ON announcement_acks(announcement_id, employee_id);
