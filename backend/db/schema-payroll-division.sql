-- Phase 8: Division-wise payroll (WPS vs bank transfer)
-- Safe to re-run.

ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

UPDATE payslips p
SET payment_method = COALESCE(dv.payroll_type, 'wps')
FROM employees e
LEFT JOIN divisions dv ON dv.id = e.division_id
WHERE p.employee_id = e.id
  AND (p.payment_method IS NULL OR TRIM(p.payment_method) = '');

ALTER TABLE payslips
  DROP CONSTRAINT IF EXISTS payslips_payment_method_chk;

ALTER TABLE payslips
  ADD CONSTRAINT payslips_payment_method_chk
  CHECK (payment_method IS NULL OR payment_method IN ('wps', 'bank_transfer'));

CREATE INDEX IF NOT EXISTS idx_payslips_payment_method ON payslips (payment_method);
CREATE INDEX IF NOT EXISTS idx_payslips_period ON payslips (period_label);
