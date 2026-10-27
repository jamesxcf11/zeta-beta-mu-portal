-- ============================================================================
-- Migration 004 — Vault Hashtag / Tag Metadata
-- ============================================================================
-- Adds a `tags` array column to `vault_items` so uploaded photos and albums
-- can be tagged (e.g. 'scholarship', 'revalida', 'ple', 'service', 'porac',
-- 'sociability', 'yearender', 'backtoschool') for filtering, search, and
-- dynamic pillar page Vault Viewers.
-- Safe to re-run: every statement is guarded.
-- ============================================================================

ALTER TABLE vault_items
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[];

COMMENT ON COLUMN vault_items.tags IS 'Lowercase normalized hashtag/tag tokens without leading #, e.g. {scholarship,revalida,ple}';

CREATE INDEX IF NOT EXISTS idx_vault_tags
  ON vault_items USING gin(tags);
