-- Remove ALL duplicate leave rows (any status) — keeps lowest id per employee+type+dates+status.

WITH dups AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, lower(leave_type), start_date, end_date, lower(status)
      ORDER BY id
    ) AS rn
  FROM leave_requests
)
DELETE FROM approvals
WHERE request_type = 'leave'
  AND reference_id IN (SELECT id FROM dups WHERE rn > 1);

WITH dups AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, lower(leave_type), start_date, end_date, lower(status)
      ORDER BY id
    ) AS rn
  FROM leave_requests
)
DELETE FROM leave_requests
WHERE id IN (SELECT id FROM dups WHERE rn > 1);
