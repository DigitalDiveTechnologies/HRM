-- Benefits & Medical Insurance Tracking Schema (Zero Regression, Additive Only)

CREATE TABLE IF NOT EXISTS benefit_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    benefit_type VARCHAR(50) NOT NULL DEFAULT 'medical_insurance',
    provider_name VARCHAR(100) NOT NULL,
    policy_number VARCHAR(100) NOT NULL,
    coverage_summary TEXT,
    annual_premium_employer NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    annual_premium_employee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_benefits (
    id SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    benefit_plan_id INT NOT NULL REFERENCES benefit_plans(id) ON DELETE RESTRICT,
    member_id VARCHAR(100),
    coverage_tier VARCHAR(50) NOT NULL DEFAULT 'employee_only',
    dependents_count INT NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emp_benefits ON employee_benefits(employee_id, status);
