-- ============================================================================
-- Zeta Beta Mu Fraternity Portal — HARDENED Row Level Security (RLS) Policies
-- ============================================================================
-- This file replaces rls-policies.sql with tighter access controls.
--
-- ARCHITECTURAL LIMITATION:
--   The app currently uses the Supabase ANON key for all operations and manages
--   sessions in localStorage (not Supabase Auth). Member IDs are integers, not
--   auth UUIDs, so auth.uid()-based ownership checks cannot work yet.
--
--   Until the app migrates to Supabase Auth (linking members.id to auth.users),
--   true server-side per-user authorization is impossible. These policies
--   represent the best intermediate hardening:
--     1. Reads remain open to anon (app needs them).
--     2. Writes are restricted to the `authenticated` role where possible.
--     3. Sensitive tables (moderation_reports, system_logs, members role changes)
--        are locked down to admin/officer only via a helper function.
--     4. Ideal auth-based policies are included as comments for the migration.
--
-- MIGRATION PATH (status):
--   1. DONE — `members.auth_id UUID REFERENCES auth.users` exists
--      (schema-postgres.sql) and js/auth.js populates it on signup.
--   2. DONE — the frontend uses db.auth.signInWithPassword (js/auth.js).
--   3. REMAINING — seed-data.sql members have no auth_id and no matching
--      auth.users rows, so those demo accounts cannot satisfy auth.uid()
--      checks. Create accounts through the signup flow for testing.
-- ============================================================================

-- Drop all existing prototype policies
DROP POLICY IF EXISTS "members_read"     ON members;
DROP POLICY IF EXISTS "members_write"    ON members;
DROP POLICY IF EXISTS "posts_read"       ON posts;
DROP POLICY IF EXISTS "posts_write"      ON posts;
DROP POLICY IF EXISTS "comments_read"    ON comments;
DROP POLICY IF EXISTS "comments_write"   ON comments;
DROP POLICY IF EXISTS "reactions_read"   ON post_reactions;
DROP POLICY IF EXISTS "reactions_write"  ON post_reactions;
DROP POLICY IF EXISTS "magazines_read"   ON magazines;
DROP POLICY IF EXISTS "magazines_write"  ON magazines;
DROP POLICY IF EXISTS "vault_read"       ON vault_items;
DROP POLICY IF EXISTS "vault_write"      ON vault_items;
DROP POLICY IF EXISTS "announcements_read"  ON announcements;
DROP POLICY IF EXISTS "announcements_write" ON announcements;
DROP POLICY IF EXISTS "events_read"      ON events;
DROP POLICY IF EXISTS "events_write"     ON events;
DROP POLICY IF EXISTS "attendees_read"   ON event_attendees;
DROP POLICY IF EXISTS "attendees_write"  ON event_attendees;
DROP POLICY IF EXISTS "birthdays_read"   ON birthday_calendar;
DROP POLICY IF EXISTS "birthdays_write"  ON birthday_calendar;
DROP POLICY IF EXISTS "reports_read"     ON moderation_reports;
DROP POLICY IF EXISTS "reports_write"    ON moderation_reports;
DROP POLICY IF EXISTS "logs_read"        ON system_logs;
DROP POLICY IF EXISTS "logs_insert"      ON system_logs;

-- ============================================================================
-- HELPER FUNCTION: Check if the current user is an admin or officer
-- ============================================================================
-- Once Supabase Auth is in use, this will look up the member record by
-- auth.uid() and check the role. For now it returns FALSE for anon, which
-- effectively blocks sensitive writes until auth is implemented.
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

-- ============================================================================
-- INTERMEDIATE POLICIES (anon key era)
-- ============================================================================
-- Reads: open to anon (app needs to display content).
-- Writes: restricted to `authenticated` role (requires Supabase Auth session).
-- Sensitive tables: restricted to admin/officer only.
-- ============================================================================

-- MEMBERS: read non-deleted; writes restricted (no self-registration via API)
CREATE POLICY "members_read" ON members
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

-- Only admin/officer can insert/update/delete members (e.g., approve pending)
CREATE POLICY "members_admin_write" ON members
  FOR ALL TO authenticated
  USING (is_admin_or_officer()) WITH CHECK (is_admin_or_officer());

-- POSTS: read published; authenticated users can create/edit own
CREATE POLICY "posts_read" ON posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY "posts_insert" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE TO authenticated
  USING (member_id = (
    SELECT id FROM members WHERE auth_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY "posts_delete_admin" ON posts
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- COMMENTS: read published; authenticated users can comment
CREATE POLICY "comments_read" ON comments
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "comments_delete_admin" ON comments
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- POST_REACTIONS: read all; authenticated can toggle reactions
CREATE POLICY "reactions_read" ON post_reactions
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY "reactions_insert" ON post_reactions
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "reactions_delete_own" ON post_reactions
  FOR DELETE TO authenticated
  USING (member_id = (
    SELECT id FROM members WHERE auth_id = auth.uid() AND deleted_at IS NULL
  ));

-- MAGAZINES: read published; admin/officer write
CREATE POLICY "magazines_read" ON magazines
  FOR SELECT TO anon, authenticated
  USING (is_published = TRUE);

CREATE POLICY "magazines_admin_write" ON magazines
  FOR ALL TO authenticated
  USING (is_admin_or_officer()) WITH CHECK (is_admin_or_officer());

-- VAULT_ITEMS: read non-deleted; authenticated can upload; admin can delete
CREATE POLICY "vault_read" ON vault_items
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "vault_insert" ON vault_items
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "vault_delete_admin" ON vault_items
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- ANNOUNCEMENTS: read non-deleted; admin/officer write
CREATE POLICY "announcements_read" ON announcements
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "announcements_admin_write" ON announcements
  FOR ALL TO authenticated
  USING (is_admin_or_officer()) WITH CHECK (is_admin_or_officer());

-- EVENTS: read published; admin/officer write
CREATE POLICY "events_read" ON events
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "events_admin_write" ON events
  FOR ALL TO authenticated
  USING (is_admin_or_officer()) WITH CHECK (is_admin_or_officer());

-- EVENT_ATTENDEES: read all; authenticated can RSVP
CREATE POLICY "attendees_read" ON event_attendees
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY "attendees_insert" ON event_attendees
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "attendees_delete_own" ON event_attendees
  FOR DELETE TO authenticated
  USING (member_id = (
    SELECT id FROM members WHERE auth_id = auth.uid() AND deleted_at IS NULL
  ));

-- BIRTHDAY_CALENDAR: read shown birthdays; admin/officer write
CREATE POLICY "birthdays_read" ON birthday_calendar
  FOR SELECT TO anon, authenticated
  USING (show_on_calendar = TRUE);

CREATE POLICY "birthdays_admin_write" ON birthday_calendar
  FOR ALL TO authenticated
  USING (is_admin_or_officer()) WITH CHECK (is_admin_or_officer());

-- MODERATION_REPORTS: admin/officer read+write only
CREATE POLICY "reports_admin_read" ON moderation_reports
  FOR SELECT TO authenticated
  USING (is_admin_or_officer());

CREATE POLICY "reports_admin_write" ON moderation_reports
  FOR ALL TO authenticated
  USING (is_admin_or_officer()) WITH CHECK (is_admin_or_officer());

-- SYSTEM_LOGS: admin/officer read; authenticated insert only
CREATE POLICY "logs_admin_read" ON system_logs
  FOR SELECT TO authenticated
  USING (is_admin_or_officer());

CREATE POLICY "logs_insert" ON system_logs
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- ============================================================================
-- IDEAL POLICIES (post-migration to Supabase Auth)
-- ============================================================================
-- Uncomment these AFTER:
--   1. Adding `user_id UUID REFERENCES auth.users` to the members table
--   2. Populating user_id for all existing members
--   3. Switching the frontend to use db.auth.signInWithPassword()
--   4. Dropping the intermediate policies above
--
-- -- Helper: get current member id
-- CREATE OR REPLACE FUNCTION current_member_id()
-- RETURNS INTEGER
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   SELECT id FROM members WHERE user_id = auth.uid() AND deleted_at IS NULL;
-- $$;
--
-- -- MEMBERS: users can read all, update own profile, admin can do all
-- CREATE POLICY "members_read" ON members FOR SELECT TO authenticated
--   USING (deleted_at IS NULL);
-- CREATE POLICY "members_update_own" ON members FOR UPDATE TO authenticated
--   USING (id = current_member_id()) WITH CHECK (id = current_member_id());
-- CREATE POLICY "members_admin_all" ON members FOR ALL TO authenticated
--   USING (is_admin_or_officer()) WITH CHECK (is_admin_or_officer());
--
-- -- POSTS: users can CRUD own posts, admin can delete any
-- CREATE POLICY "posts_read" ON posts FOR SELECT TO authenticated
--   USING (status = 'published' AND deleted_at IS NULL);
-- CREATE POLICY "posts_insert" ON posts FOR INSERT TO authenticated
--   WITH CHECK (author_id = current_member_id());
-- CREATE POLICY "posts_update_own" ON posts FOR UPDATE TO authenticated
--   USING (author_id = current_member_id());
-- CREATE POLICY "posts_delete_own" ON posts FOR DELETE TO authenticated
--   USING (author_id = current_member_id());
-- CREATE POLICY "posts_delete_admin" ON posts FOR DELETE TO authenticated
--   USING (is_admin_or_officer());
--
-- (Continue similarly for all tables...)
-- ============================================================================

-- ============================================================================
-- END OF HARDENED RLS POLICIES
-- ============================================================================
