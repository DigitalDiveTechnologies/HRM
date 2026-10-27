-- Task 3.3: 360-Degree Peer Feedback Nomination & Evaluation Workflow
CREATE TABLE IF NOT EXISTS performance_peer_nominations (
    id SERIAL PRIMARY KEY,
    review_id INT NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
    nominee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'submitted', 'declined'
    feedback_json JSONB,
    is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_peer_nom ON performance_peer_nominations(review_id, reviewer_id, status);
