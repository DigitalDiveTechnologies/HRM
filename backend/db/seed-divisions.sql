-- GOCs seed divisions (idempotent)

INSERT INTO divisions (code, name, payroll_type, status)
VALUES
  ('ALKIDMA', 'Alkidma', 'wps', 'active'),
  ('ALQAT', 'Alqat', 'wps', 'active'),
  ('OVERSEAS', 'Overseas', 'bank_transfer', 'active'),
  ('ROYAL_OCEANS', 'Royal Oceans', 'wps', 'active')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  payroll_type = EXCLUDED.payroll_type,
  status = EXCLUDED.status;
