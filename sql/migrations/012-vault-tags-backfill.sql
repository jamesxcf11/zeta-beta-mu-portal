-- Migration 012 — Backfill vault_items.tags from legacy #hashtags stored in caption.
-- Safe to re-run: only touches rows whose tags are empty.
UPDATE vault_items v
SET tags = COALESCE((
  SELECT array_agg(DISTINCT lower(m[1]))
  FROM regexp_matches(v.caption, '#([A-Za-z0-9_-]+)', 'g') AS m
), '{}'::TEXT[])
WHERE v.caption LIKE '%#%'
  AND (v.tags IS NULL OR cardinality(v.tags) = 0);
