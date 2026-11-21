-- Adds roster details to the alumni directory: semester of induction, roster
-- number, awards, deceased flag and birthday. `batch` keeps the batch name.
-- Existing RLS is unchanged (authenticated read, writes only via admin-alumni).
-- Apply in the Supabase SQL Editor after 009-memorial-seed-support.sql.

BEGIN;

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS semester    VARCHAR(100);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS member_no   INTEGER CHECK (member_no > 0);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS awards      VARCHAR(255);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS is_deceased BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS birthday    DATE;

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS other_emails VARCHAR(500);

-- Several numbers per person are common in the roster.
ALTER TABLE alumni ALTER COLUMN mobile    TYPE VARCHAR(255);
ALTER TABLE alumni ALTER COLUMN telephone TYPE VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_alumni_member_no ON alumni(member_no);

COMMIT;
