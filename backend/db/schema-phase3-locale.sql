-- Phase 3 — user locale preference (EN/AR)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_locale_chk;
ALTER TABLE users
  ADD CONSTRAINT users_preferred_locale_chk CHECK (preferred_locale IN ('en', 'ar'));
