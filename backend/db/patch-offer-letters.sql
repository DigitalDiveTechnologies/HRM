-- Task 5.1: Dynamic Employment Offer Letter Generator (Feature #24)
CREATE TABLE IF NOT EXISTS candidate_offers (
    id SERIAL PRIMARY KEY,
    candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id INT REFERENCES job_postings(id) ON DELETE SET NULL,
    designation VARCHAR(150) NOT NULL,
    offered_basic_salary NUMERIC(12,2) NOT NULL,
    offered_housing_allowance NUMERIC(12,2) DEFAULT 0.00,
    offered_transport_allowance NUMERIC(12,2) DEFAULT 0.00,
    joining_date DATE NOT NULL,
    probation_period_months INT DEFAULT 6,
    contract_type VARCHAR(50) DEFAULT 'limited', -- 'limited', 'unlimited'
    status VARCHAR(30) DEFAULT 'draft', -- 'draft', 'issued', 'accepted', 'declined'
    offer_html TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_candidate_offers_candidate_id ON candidate_offers(candidate_id);
