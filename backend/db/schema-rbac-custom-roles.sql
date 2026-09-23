-- Allow custom role codes on users.role (roles table is source of truth)
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'users' AND c.contype = 'c' AND c.conname ILIKE '%role%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', conname);
  END IF;
END $$;
