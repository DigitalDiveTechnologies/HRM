-- Migration: schema-community-feed.sql
-- Chat 4: Employee Community, Social Feed & Interaction Wall

CREATE TABLE IF NOT EXISTS community_posts (
    id SERIAL PRIMARY KEY,
    author_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    post_type VARCHAR(30) NOT NULL DEFAULT 'general', -- 'general', 'kudos', 'celebration'
    content TEXT NOT NULL,
    image_url VARCHAR(500),
    likes_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS community_post_likes (
    post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, employee_id)
);

CREATE TABLE IF NOT EXISTS community_post_comments (
    id SERIAL PRIMARY KEY,
    post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_post_comments(post_id, created_at ASC);
