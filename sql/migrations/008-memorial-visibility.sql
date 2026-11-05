-- Per-memorial visibility for the public Sacrifice page.
-- Apply in the Supabase SQL Editor after 007-alumni.sql.
--
-- is_public = TRUE  -> shown on the public honor roll (pillars-sacrifice.html)
-- is_public = FALSE -> visible to logged-in members only (In Memoriam)

BEGIN;

ALTER TABLE memorials ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

DROP POLICY IF EXISTS "memorials_read" ON memorials;
DROP POLICY IF EXISTS "memorials_read_public" ON memorials;
DROP POLICY IF EXISTS "memorials_read_members" ON memorials;

CREATE POLICY "memorials_read_public" ON memorials
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND is_public = TRUE);

CREATE POLICY "memorials_read_members" ON memorials
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

COMMIT;
