-- Task 5.6: Configurable Multi-Tier Approval Rules & Routing (Feature #16)
CREATE TABLE IF NOT EXISTS approval_routing_rules (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(50) NOT NULL, -- 'leave', 'expense', 'travel', 'exit'
    department_id INT REFERENCES departments(id) ON DELETE CASCADE,
    min_threshold NUMERIC(12,2) DEFAULT 0, -- e.g. expenses > AED 2,000
    max_threshold NUMERIC(12,2),
    levels_count INT NOT NULL DEFAULT 1, -- 1-tier, 2-tier (Manager -> Director)
    approver_role VARCHAR(50) NOT NULL DEFAULT 'manager',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_approval_routing_req_type ON approval_routing_rules(request_type, department_id);

-- Seed sensible default routing rules if none exist
INSERT INTO approval_routing_rules (request_type, min_threshold, max_threshold, levels_count, approver_role, is_active)
SELECT 'expense', 0, 2000, 1, 'manager', TRUE
WHERE NOT EXISTS (SELECT 1 FROM approval_routing_rules WHERE request_type = 'expense');

INSERT INTO approval_routing_rules (request_type, min_threshold, max_threshold, levels_count, approver_role, is_active)
SELECT 'expense', 2000.01, 10000, 2, 'director', TRUE
WHERE NOT EXISTS (SELECT 1 FROM approval_routing_rules WHERE request_type = 'expense' AND levels_count = 2);

INSERT INTO approval_routing_rules (request_type, min_threshold, max_threshold, levels_count, approver_role, is_active)
SELECT 'leave', 0, NULL, 1, 'manager', TRUE
WHERE NOT EXISTS (SELECT 1 FROM approval_routing_rules WHERE request_type = 'leave');

INSERT INTO approval_routing_rules (request_type, min_threshold, max_threshold, levels_count, approver_role, is_active)
SELECT 'travel', 0, NULL, 2, 'manager', TRUE
WHERE NOT EXISTS (SELECT 1 FROM approval_routing_rules WHERE request_type = 'travel');
