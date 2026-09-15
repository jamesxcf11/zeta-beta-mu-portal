-- Enforce post ownership for authenticated feed writes.
-- Apply in the Supabase SQL Editor after 002-member-preferences.sql.

BEGIN;

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

DROP POLICY IF EXISTS "posts_write" ON posts;
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "posts_update" ON posts;
DROP POLICY IF EXISTS "posts_update_own" ON posts;
DROP POLICY IF EXISTS "posts_delete" ON posts;
DROP POLICY IF EXISTS "posts_delete_own" ON posts;
DROP POLICY IF EXISTS "posts_delete_admin" ON posts;
DROP POLICY IF EXISTS "posts_delete_moderator" ON posts;

CREATE POLICY "posts_insert"
  ON posts
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = current_member_id());

CREATE POLICY "posts_update_own"
  ON posts
  FOR UPDATE
  TO authenticated
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());

CREATE POLICY "posts_delete_own"
  ON posts
  FOR DELETE
  TO authenticated
  USING (member_id = current_member_id());

CREATE POLICY "posts_delete_moderator"
  ON posts
  FOR DELETE
  TO authenticated
  USING (is_admin_or_officer());

COMMIT;
