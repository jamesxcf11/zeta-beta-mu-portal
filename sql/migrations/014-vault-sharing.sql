-- ============================================================================
-- Migration 014 — Share Vault albums to the Home feed / announcements
-- ============================================================================
-- Records which feed post / announcement was created for an album (so it can't
-- be shared twice) and lets feed posts and announcements link back to the album.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE vault_items
  ADD COLUMN IF NOT EXISTS shared_post_id         BIGINT,
  ADD COLUMN IF NOT EXISTS shared_announcement_id BIGINT;

ALTER TABLE posts         ADD COLUMN IF NOT EXISTS vault_album_id VARCHAR(100);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS vault_album_id VARCHAR(100);
