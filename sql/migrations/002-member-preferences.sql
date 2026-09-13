-- ============================================================================
-- Migration 002 — Member preferences (Settings page)
-- ============================================================================
-- Run AFTER schema-postgres.sql and 001-r2-vault.sql.
-- Safe to re-run: every statement is guarded.
--
-- Purpose:
--   Store per-member settings (notification toggles, privacy flags) as a JSONB
--   document on the members row. Read/written by netlify/functions/settings.js
--   via the service role — the hardened RLS only permits admin/officer writes
--   on members, and birthday_calendar writes are admin/officer-only as well,
--   so member-facing privacy toggles must go through the function.
-- ============================================================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN members.preferences IS 'Per-member settings written by /api/settings. Shape: { "notifications": { "reactions": bool, "comments": bool, "announcements": bool }, "privacy": { "showOnCalendar": bool, "showAge": bool } }';
