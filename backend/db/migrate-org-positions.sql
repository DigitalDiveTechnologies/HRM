-- One-time / re-runnable: map active employees → positions + primary assignments
-- Requires schema-org-foundation.sql applied first.
-- Keeps employees.manager_id; also sets positions.reports_to_position_id from manager positions.

DO $$
DECLARE
  v_entity_id INT;
  v_branch_id INT;
BEGIN
  SELECT id INTO v_entity_id FROM legal_entities WHERE code = 'GOCS' LIMIT 1;
  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'legal_entities GOCS missing — apply schema-org-foundation.sql first';
  END IF;

  SELECT id INTO v_branch_id FROM branches WHERE legal_entity_id = v_entity_id AND code = 'DXB-HQ' LIMIT 1;

  -- Create a position per active HR employee that lacks a current primary assignment
  INSERT INTO positions (
    code, legal_entity_id, branch_id, department_id, division_id, designation_id,
    title, status, effective_from
  )
  SELECT
    'P-E' || e.id::text,
    v_entity_id,
    v_branch_id,
    e.department_id,
    e.division_id,
    e.designation_id,
    COALESCE(NULLIF(TRIM(e.job_title), ''), dg.name, e.full_name, 'Position'),
    'occupied',
    COALESCE(e.join_date, CURRENT_DATE)
  FROM employees e
  LEFT JOIN designations dg ON dg.id = e.designation_id
  WHERE e.in_hr_ops = TRUE
    AND e.status <> 'exited'
    AND NOT EXISTS (
      SELECT 1 FROM position_assignments pa
      WHERE pa.employee_id = e.id
        AND pa.is_primary = TRUE
        AND pa.effective_to IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM positions p WHERE p.code = 'P-E' || e.id::text
    );

  -- Primary assignments
  INSERT INTO position_assignments (position_id, employee_id, assignment_type, is_primary, effective_from)
  SELECT p.id, e.id, 'primary', TRUE, COALESCE(e.join_date, CURRENT_DATE)
  FROM employees e
  INNER JOIN positions p ON p.code = 'P-E' || e.id::text
  WHERE e.in_hr_ops = TRUE
    AND e.status <> 'exited'
    AND NOT EXISTS (
      SELECT 1 FROM position_assignments pa
      WHERE pa.employee_id = e.id
        AND pa.position_id = p.id
        AND pa.is_primary = TRUE
        AND pa.effective_to IS NULL
    );

  -- Wire reports_to from manager_id → manager's position
  UPDATE positions child
  SET reports_to_position_id = mgr_pos.id
  FROM employees e
  INNER JOIN employees m ON m.id = e.manager_id
  INNER JOIN positions mgr_pos ON mgr_pos.code = 'P-E' || m.id::text
  WHERE child.code = 'P-E' || e.id::text
    AND e.manager_id IS NOT NULL
    AND child.reports_to_position_id IS DISTINCT FROM mgr_pos.id
    AND mgr_pos.id <> child.id;

  -- Mark occupied positions that have open primary assignment
  UPDATE positions p
  SET status = 'occupied'
  WHERE EXISTS (
    SELECT 1 FROM position_assignments pa
    WHERE pa.position_id = p.id AND pa.is_primary AND pa.effective_to IS NULL
  )
  AND p.status <> 'frozen';

  -- Vacant if approved/occupied but no open assignment
  UPDATE positions p
  SET status = 'vacant'
  WHERE p.status IN ('approved', 'occupied')
    AND NOT EXISTS (
      SELECT 1 FROM position_assignments pa
      WHERE pa.position_id = p.id AND pa.effective_to IS NULL
    );
END $$;
