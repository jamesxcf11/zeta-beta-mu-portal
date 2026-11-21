-- Directory search: master-Excel fields, a search index, and server-only reads.
-- After this migration the browser can no longer SELECT from `alumni`; members
-- search through the Netlify function directory-search (service role), which
-- returns limited fields to members and full contact details to officers.
-- Apply in the Supabase SQL Editor after 010-alumni-batch-awards.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS last_name     VARCHAR(100);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS first_name    VARCHAR(100);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS middle_name   VARCHAR(100);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS schedule      TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS intl_location VARCHAR(100);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS is_retired    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS search_text   TEXT;

-- Several hospitals / long specializations per person.
ALTER TABLE alumni ALTER COLUMN hospital       TYPE TEXT;
ALTER TABLE alumni ALTER COLUMN specialization TYPE TEXT;

-- Lower-cased, accent-stripped text that the search matches against.
CREATE OR REPLACE FUNCTION alumni_build_search_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_text := translate(
        lower(concat_ws(' ', NEW.full_name, NEW.nickname, NEW.batch, NEW.hospital,
                        NEW.specialization, NEW.field_of_medicine, NEW.intl_location)),
        'áàâäãåéèêëíìîïóòôöõúùûüñç',
        'aaaaaaeeeeiiiiooooouuuunc');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alumni_search_text ON alumni;
CREATE TRIGGER trg_alumni_search_text BEFORE INSERT OR UPDATE ON alumni
    FOR EACH ROW EXECUTE FUNCTION alumni_build_search_text();

-- Backfill rows that already exist.
UPDATE alumni SET full_name = full_name;

CREATE INDEX IF NOT EXISTS idx_alumni_search_trgm ON alumni USING gin (search_text extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumni_last_name ON alumni(last_name);

-- Reads now go through the officer/member-aware Netlify function only.
DROP POLICY IF EXISTS "alumni_read" ON alumni;

COMMIT;
