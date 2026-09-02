-- Employee profile photo path (separate from Documents: passport/CNIC/visa).
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS photo_path TEXT;
