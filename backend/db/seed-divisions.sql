-- GOCs seed divisions (idempotent, avoids name/code collisions)

INSERT INTO divisions (code, name, payroll_type, status)
SELECT v.code, v.name, v.payroll_type, v.status
FROM (VALUES
  ('ALKIDMA', 'Alkidma', 'wps', 'active'),
  ('ALQAT', 'Alqat', 'wps', 'active'),
  ('OVERSEAS', 'Overseas', 'bank_transfer', 'active'),
  ('ROYAL_OCEANS', 'Royal Oceans', 'wps', 'active')
) AS v(code, name, payroll_type, status)
WHERE NOT EXISTS (
  SELECT 1 FROM divisions d
  WHERE LOWER(TRIM(d.name)) = LOWER(TRIM(v.name))
     OR LOWER(TRIM(d.code)) = LOWER(TRIM(v.code))
);
