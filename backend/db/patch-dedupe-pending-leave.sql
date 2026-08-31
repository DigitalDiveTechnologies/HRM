-- Remove duplicate pending leave rows (same employee, type, dates) — keeps lowest id.

WITH dups AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, lower(leave_type), start_date, end_date
      ORDER BY id
    ) AS rn
  FROM leave_requests
  WHERE lower(status) = 'pending'
)
DELETE FROM approvals
WHERE request_type = 'leave'
  AND reference_id IN (SELECT id FROM dups WHERE rn > 1);

WITH dups AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, lower(leave_type), start_date, end_date
      ORDER BY id
    ) AS rn
  FROM leave_requests
  WHERE lower(status) = 'pending'
)
DELETE FROM leave_requests
WHERE id IN (SELECT id FROM dups WHERE rn > 1);
