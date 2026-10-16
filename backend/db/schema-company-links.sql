-- Corporate Quick Links Directory Schema (Zero Regression, Additive Only)

CREATE TABLE IF NOT EXISTS company_links (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    icon_key VARCHAR(50) NOT NULL DEFAULT 'external-link',
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_links_active ON company_links(is_active, sort_order);

-- Seed initial corporate bookmarks if empty
INSERT INTO company_links (title, url, icon_key, category, sort_order, is_active)
SELECT * FROM (VALUES
    ('MOHRE UAE Portal', 'https://www.mohre.gov.ae', 'globe', 'Government & Labour', 10, true),
    ('UAE PASS Digital ID', 'https://selfcare.uaepass.ae', 'shield', 'Government & Labour', 20, true),
    ('Corporate Webmail (Office 365)', 'https://outlook.office.com', 'mail', 'Productivity', 30, true),
    ('Medical Insurance Claims (Daman)', 'https://www.damanhealth.ae', 'heart', 'Health & Wellness', 40, true),
    ('IT Service Desk & Support', 'https://support.digitaldive.demo', 'life-buoy', 'IT & Operations', 50, true),
    ('Employee Handbook & Policies', 'https://gocs-hr-portal.vercel.app/documents', 'book', 'Company Resources', 60, true),
    ('GOCs Learning Center', 'https://gocs-hr-portal.vercel.app/training', 'award', 'Career & Training', 70, true),
    ('Dubai Health Authority (DHA)', 'https://www.dha.gov.ae', 'activity', 'Health & Wellness', 80, true)
) AS v(title, url, icon_key, category, sort_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM company_links LIMIT 1);
