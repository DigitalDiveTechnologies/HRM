INSERT INTO eosb_rule_versions (code, jurisdiction_profile, formula_version, description)
VALUES (
  'UAE_MAINLAND_V1_PREVIEW',
  'uae_mainland',
  'v1-preview',
  'Mainland expat gratuity preview 21/30 day bands. Unpaid leave deduction flag on. Not production-certified until specialist sign-off.'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO payroll_employer_config (legal_entity_id, bank_or_exchange_name, sif_spec_version, is_preview)
SELECT le.id, NULL, 'PENDING_SIR_SPEC', TRUE
FROM legal_entities le
WHERE le.code = 'GOCS'
  AND NOT EXISTS (
    SELECT 1 FROM payroll_employer_config c
    WHERE c.legal_entity_id = le.id AND c.effective_to IS NULL
  );
