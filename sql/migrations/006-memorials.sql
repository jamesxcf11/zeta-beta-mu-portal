-- In Memoriam: deceased brothers (memorials) and member comments.
-- Apply in the Supabase SQL Editor after 005-signup-profile-trigger.sql.
-- Self-contained: (re)defines the helper functions it depends on, using the
-- same definitions as 003-post-ownership.sql and rls-policies-hardened.sql.

BEGIN;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION current_member_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM members
  WHERE auth_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION is_admin_or_officer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members m
    WHERE m.auth_id = auth.uid()
      AND m.role IN ('admin', 'officer')
      AND m.deleted_at IS NULL
  );
$$;

CREATE TABLE IF NOT EXISTS memorials (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    nickname        VARCHAR(100),
    batch           VARCHAR(50),
    specialty       VARCHAR(255),
    birth_year      INTEGER CHECK (birth_year BETWEEN 1800 AND 2200),
    death_year      INTEGER CHECK (death_year BETWEEN 1800 AND 2200),
    tribute         TEXT,
    photo_url       VARCHAR(500),
    photo_key       VARCHAR(500),
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_memorials_order ON memorials(sort_order, death_year DESC);

DROP TRIGGER IF EXISTS trg_memorials_updated_at ON memorials;
CREATE TRIGGER trg_memorials_updated_at BEFORE UPDATE ON memorials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS memorial_comments (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    memorial_id     BIGINT NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    member_id       BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    content         TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_memorial_comments_memorial ON memorial_comments(memorial_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memorial_comments_member ON memorial_comments(member_id);

ALTER TABLE memorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memorials_read" ON memorials;
DROP POLICY IF EXISTS "memorials_admin_write" ON memorials;
DROP POLICY IF EXISTS "memorial_comments_read" ON memorial_comments;
DROP POLICY IF EXISTS "memorial_comments_insert" ON memorial_comments;
DROP POLICY IF EXISTS "memorial_comments_delete_own" ON memorial_comments;
DROP POLICY IF EXISTS "memorial_comments_delete_moderator" ON memorial_comments;

CREATE POLICY "memorials_read" ON memorials
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "memorials_admin_write" ON memorials
  FOR ALL TO authenticated
  USING (is_admin_or_officer()) WITH CHECK (is_admin_or_officer());

CREATE POLICY "memorial_comments_read" ON memorial_comments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "memorial_comments_insert" ON memorial_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = current_member_id()
    AND EXISTS (SELECT 1 FROM members m WHERE m.id = member_id AND m.status = 'active')
  );

CREATE POLICY "memorial_comments_delete_own" ON memorial_comments
  FOR DELETE TO authenticated
  USING (member_id = current_member_id());

CREATE POLICY "memorial_comments_delete_moderator" ON memorial_comments
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

COMMIT;
