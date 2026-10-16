-- Digital Signatures Schema (Zero Regression, Additive Only)

CREATE TABLE IF NOT EXISTS digital_signatures (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL, -- 'nda', 'handbook', 'asset_receipt', 'exit_clearance', 'onboarding'
    document_id INT NOT NULL,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    signer_email VARCHAR(120) NOT NULL,
    signature_base64 TEXT NOT NULL,
    document_sha256 VARCHAR(64) NOT NULL,
    ip_address VARCHAR(50) NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_digital_signatures_doc ON digital_signatures(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_emp ON digital_signatures(employee_id);
