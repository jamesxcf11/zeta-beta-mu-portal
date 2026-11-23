-- ============================================================================
-- Migration 013 — Vault hardening
-- ============================================================================
-- 1. Reject placeholder titles ("none", "null", ...) and missing event dates on
--    NEW / UPDATED rows. Constraints are NOT VALID so existing rows are left
--    untouched (clean them manually, then run VALIDATE CONSTRAINT).
-- 2. rejection_reason column for officer rejects.
-- 3. vault_read policy: anon sees approved + public only; signed-in members see
--    all approved; officers/admins see everything. Pending/rejected rows are no
--    longer readable by regular users.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE vault_items DROP CONSTRAINT IF EXISTS vault_title_valid;
ALTER TABLE vault_items
  ADD CONSTRAINT vault_title_valid
  CHECK (length(trim(title)) > 0 AND lower(trim(title)) NOT IN ('none', 'null', 'undefined', 'n/a'))
  NOT VALID;

ALTER TABLE vault_items DROP CONSTRAINT IF EXISTS vault_event_date_required;
ALTER TABLE vault_items
  ADD CONSTRAINT vault_event_date_required
  CHECK (event_date IS NOT NULL)
  NOT VALID;

ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DROP POLICY IF EXISTS "vault_read" ON vault_items;

CREATE POLICY "vault_read" ON vault_items
  FOR SELECT TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND (
      (approval_status = 'approved' AND (is_public = TRUE OR auth.uid() IS NOT NULL))
      OR is_admin_or_officer()
    )
  );
