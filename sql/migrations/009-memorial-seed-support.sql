-- Lets sql/seed-memorials.sql upsert by name so it is safe to re-run.
-- Apply in the Supabase SQL Editor after 008-memorial-visibility.sql.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_memorials_full_name
  ON memorials (lower(full_name))
  WHERE deleted_at IS NULL;

COMMIT;
