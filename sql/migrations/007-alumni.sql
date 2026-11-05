-- Alumni roster for the Directory. Separate from `members` (portal accounts):
-- most alumni have no login. Rows are written only by the officer-only
-- Netlify function admin-alumni (service role); logged-in members can read.
-- Apply in the Supabase SQL Editor after 006-memorials.sql.

BEGIN;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS alumni (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name           VARCHAR(255) NOT NULL,
    nickname            VARCHAR(100),
    batch               VARCHAR(50),
    graduation_year     INTEGER CHECK (graduation_year BETWEEN 1900 AND 2100),
    hospital            VARCHAR(255),
    field_of_medicine   VARCHAR(100),
    specialization      VARCHAR(255),
    email               VARCHAR(255),
    mobile              VARCHAR(50),
    telephone           VARCHAR(50),
    address             TEXT,
    facebook            VARCHAR(255),
    instagram           VARCHAR(255),
    avatar_url          VARCHAR(500),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_alumni_name ON alumni(full_name);
CREATE INDEX IF NOT EXISTS idx_alumni_batch ON alumni(batch);
CREATE INDEX IF NOT EXISTS idx_alumni_field ON alumni(field_of_medicine);

DROP TRIGGER IF EXISTS trg_alumni_updated_at ON alumni;
CREATE TRIGGER trg_alumni_updated_at BEFORE UPDATE ON alumni
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE alumni ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alumni_read" ON alumni;
CREATE POLICY "alumni_read" ON alumni
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

COMMIT;
