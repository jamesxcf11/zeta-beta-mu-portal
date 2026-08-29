-- ============================================================================
-- Migration 001 — Cloudflare R2 media storage
-- ============================================================================
-- Run AFTER schema-postgres.sql (and after seed-data.sql if seeding).
-- Safe to re-run: every statement is guarded.
--
-- Purpose:
--   1. Store R2 object keys alongside public URLs so objects can be DELETED
--      later (previously impossible — only the URL was persisted).
--   2. Widen media URL columns. VARCHAR(500) is too small, and js/feed.js was
--      writing base64 data URLs into posts.image_url, which fails outright.
--   3. Gate private vault albums at the row level, not just in the UI.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. vault_items: R2 object keys
-- ----------------------------------------------------------------------------
ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS file_key  VARCHAR(500);
ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS thumb_key VARCHAR(500);

COMMENT ON COLUMN vault_items.file_key  IS 'R2 object key for the full-size image, e.g. vault/album-123/uuid.webp';
COMMENT ON COLUMN vault_items.thumb_key IS 'R2 object key for the 400px thumbnail, e.g. vault/album-123/thumbs/uuid.webp';

-- ----------------------------------------------------------------------------
-- 2. posts: R2 object key
-- ----------------------------------------------------------------------------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_key VARCHAR(500);

COMMENT ON COLUMN posts.image_key IS 'R2 object key for the post image, e.g. posts/42/uuid.webp';

-- ----------------------------------------------------------------------------
-- 3. Widen media URL columns to TEXT
-- ----------------------------------------------------------------------------
-- A custom-domain R2 URL is short, but VARCHAR(500) leaves no headroom and was
-- the direct cause of image posts failing (base64 data URL >> 500 chars).
ALTER TABLE posts        ALTER COLUMN image_url     TYPE TEXT;
ALTER TABLE posts        ALTER COLUMN video_url     TYPE TEXT;
ALTER TABLE vault_items  ALTER COLUMN media_url     TYPE TEXT;
ALTER TABLE vault_items  ALTER COLUMN thumbnail_url TYPE TEXT;

-- ----------------------------------------------------------------------------
-- 4. Index for cleanup / orphan reconciliation
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vault_approval_created
  ON vault_items(approval_status, created_at);

-- ----------------------------------------------------------------------------
-- 5. Enforce is_public at the row level
-- ----------------------------------------------------------------------------
-- Previously vault_read exposed EVERY row to anon, including albums marked
-- private, because filtering only happened (or rather, did not happen) in the
-- client. Officers still see everything.
DROP POLICY IF EXISTS "vault_read" ON vault_items;

CREATE POLICY "vault_read" ON vault_items
  FOR SELECT TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND (
      (is_public = TRUE AND approval_status = 'approved')
      OR is_admin_or_officer()
    )
  );

-- Only officers/admins may change approval status or visibility.
DROP POLICY IF EXISTS "vault_update_officer" ON vault_items;

CREATE POLICY "vault_update_officer" ON vault_items
  FOR UPDATE TO authenticated
  USING (is_admin_or_officer())
  WITH CHECK (is_admin_or_officer());
