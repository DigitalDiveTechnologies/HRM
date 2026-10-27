-- Email Settings Configuration Table
CREATE TABLE IF NOT EXISTS app_email_settings (
    id SERIAL PRIMARY KEY,
    host VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
    port INT NOT NULL DEFAULT 587,
    username VARCHAR(255),
    password VARCHAR(500),
    from_email VARCHAR(255),
    from_name VARCHAR(255) DEFAULT 'GOCs HR',
    use_tls BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_email_settings (id, host, port, use_tls, is_active)
VALUES (1, 'smtp.gmail.com', 587, true, false)
ON CONFLICT (id) DO NOTHING;
