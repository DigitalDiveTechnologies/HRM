-- Employee profile photo path (separate from Documents: passport/CNIC/visa).
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- Content hash so the same profile picture cannot be reused on create/upload.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS photo_content_sha256 TEXT;
