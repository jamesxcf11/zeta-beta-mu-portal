-- ============================================================================
-- Zeta Beta Mu Fraternity Portal — Row Level Security (RLS) Policies
-- ============================================================================
-- Run AFTER schema-postgres.sql and seed-data.sql in the Supabase SQL Editor.
-- Enables RLS on all tables and defines ownership-aware access policies.
--
-- PREREQUISITES:
--   1. members.auth_id column must exist (added in schema-postgres.sql)
--   2. When a user signs up via Supabase Auth, the auth_id column must be
--      populated with auth.users.id (see js/auth.js setupSignupForm)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE magazines ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Resolve the authenticated member's integer ID from their Supabase Auth UUID.
-- Returns NULL if not authenticated or no matching member row exists.
CREATE OR REPLACE FUNCTION current_member_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM members WHERE auth_id = auth.uid() LIMIT 1
$$;

-- Check if the current user is an admin or officer.
-- Returns FALSE if not authenticated or not an admin/officer.
CREATE OR REPLACE FUNCTION is_admin_or_officer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'officer') FROM members WHERE auth_id = auth.uid() LIMIT 1),
    FALSE
  )
$$;

-- ============================================================================
-- DROP OLD PROTOTYPE POLICIES (if they exist from a previous run)
-- ============================================================================
DROP POLICY IF EXISTS "members_read" ON members;
DROP POLICY IF EXISTS "members_write" ON members;
DROP POLICY IF EXISTS "posts_read" ON posts;
DROP POLICY IF EXISTS "posts_write" ON posts;
DROP POLICY IF EXISTS "comments_read" ON comments;
DROP POLICY IF EXISTS "comments_write" ON comments;
DROP POLICY IF EXISTS "reactions_read" ON post_reactions;
DROP POLICY IF EXISTS "reactions_write" ON post_reactions;
DROP POLICY IF EXISTS "magazines_read" ON magazines;
DROP POLICY IF EXISTS "magazines_write" ON magazines;
DROP POLICY IF EXISTS "vault_read" ON vault_items;
DROP POLICY IF EXISTS "vault_write" ON vault_items;
DROP POLICY IF EXISTS "announcements_read" ON announcements;
DROP POLICY IF EXISTS "announcements_write" ON announcements;
DROP POLICY IF EXISTS "events_read" ON events;
DROP POLICY IF EXISTS "events_write" ON events;
DROP POLICY IF EXISTS "attendees_read" ON event_attendees;
DROP POLICY IF EXISTS "attendees_write" ON event_attendees;
DROP POLICY IF EXISTS "birthdays_read" ON birthday_calendar;
DROP POLICY IF EXISTS "birthdays_write" ON birthday_calendar;
DROP POLICY IF EXISTS "reports_read" ON moderation_reports;
DROP POLICY IF EXISTS "reports_write" ON moderation_reports;
DROP POLICY IF EXISTS "logs_read" ON system_logs;
DROP POLICY IF EXISTS "logs_insert" ON system_logs;

-- ============================================================================
-- MEMBERS
-- ============================================================================
-- Read: own row, active members (for directory), or admin/officer
CREATE POLICY "members_select" ON members
  FOR SELECT TO authenticated
  USING (
    id = current_member_id()
    OR status = 'active'
    OR is_admin_or_officer()
  );

-- Insert: self (signup) or admin
CREATE POLICY "members_insert" ON members
  FOR INSERT TO authenticated
  WITH CHECK (id = current_member_id() OR is_admin_or_officer());

-- Update: own profile or admin
CREATE POLICY "members_update" ON members
  FOR UPDATE TO authenticated
  USING (id = current_member_id() OR is_admin_or_officer())
  WITH CHECK (id = current_member_id() OR is_admin_or_officer());

-- Delete: admin only
CREATE POLICY "members_delete" ON members
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- ============================================================================
-- POSTS
-- ============================================================================
-- Read: published, non-deleted posts
CREATE POLICY "posts_select" ON posts
  FOR SELECT TO authenticated
  USING (status = 'published' AND deleted_at IS NULL);

-- Insert: authenticated users can create posts as themselves
CREATE POLICY "posts_insert" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (member_id = current_member_id());

-- Update: strictly the post owner; moderators must not alter another member's words
CREATE POLICY "posts_update" ON posts
  FOR UPDATE TO authenticated
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());

-- Delete: own post or admin
CREATE POLICY "posts_delete" ON posts
  FOR DELETE TO authenticated
  USING (member_id = current_member_id() OR is_admin_or_officer());

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Read: published, non-deleted comments
CREATE POLICY "comments_select" ON comments
  FOR SELECT TO authenticated
  USING (status = 'published' AND deleted_at IS NULL);

-- Insert: authenticated users can comment as themselves
CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (member_id = current_member_id());

-- Update: own comment or admin
CREATE POLICY "comments_update" ON comments
  FOR UPDATE TO authenticated
  USING (member_id = current_member_id() OR is_admin_or_officer())
  WITH CHECK (member_id = current_member_id() OR is_admin_or_officer());

-- Delete: own comment or admin
CREATE POLICY "comments_delete" ON comments
  FOR DELETE TO authenticated
  USING (member_id = current_member_id() OR is_admin_or_officer());

-- ============================================================================
-- POST_REACTIONS
-- ============================================================================
-- Read: all reactions
CREATE POLICY "reactions_select" ON post_reactions
  FOR SELECT TO authenticated
  USING (TRUE);

-- Insert: authenticated users can react as themselves
CREATE POLICY "reactions_insert" ON post_reactions
  FOR INSERT TO authenticated
  WITH CHECK (member_id = current_member_id());

-- Delete: own reaction only
CREATE POLICY "reactions_delete" ON post_reactions
  FOR DELETE TO authenticated
  USING (member_id = current_member_id());

-- ============================================================================
-- MAGAZINES
-- ============================================================================
-- Read: published magazines or admin/officer
CREATE POLICY "magazines_select" ON magazines
  FOR SELECT TO authenticated
  USING (is_published = TRUE OR is_admin_or_officer());

-- Insert: admin/officer only
CREATE POLICY "magazines_insert" ON magazines
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_officer());

-- Update: admin/officer only
CREATE POLICY "magazines_update" ON magazines
  FOR UPDATE TO authenticated
  USING (is_admin_or_officer())
  WITH CHECK (is_admin_or_officer());

-- Delete: admin/officer only
CREATE POLICY "magazines_delete" ON magazines
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- ============================================================================
-- VAULT_ITEMS
-- ============================================================================
-- Read: public items, own items, or admin/officer
CREATE POLICY "vault_select" ON vault_items
  FOR SELECT TO authenticated
  USING (
    (is_public = TRUE AND deleted_at IS NULL)
    OR uploaded_by = current_member_id()
    OR is_admin_or_officer()
  );

-- Insert: authenticated users can upload as themselves
CREATE POLICY "vault_insert" ON vault_items
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = current_member_id());

-- Update: own item or admin/officer
CREATE POLICY "vault_update" ON vault_items
  FOR UPDATE TO authenticated
  USING (uploaded_by = current_member_id() OR is_admin_or_officer())
  WITH CHECK (uploaded_by = current_member_id() OR is_admin_or_officer());

-- Delete: admin/officer only
CREATE POLICY "vault_delete" ON vault_items
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- ============================================================================
-- ANNOUNCEMENTS
-- ============================================================================
-- Read: non-deleted announcements
CREATE POLICY "announcements_select" ON announcements
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- Insert: admin/officer only
CREATE POLICY "announcements_insert" ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_officer());

-- Update: admin/officer only
CREATE POLICY "announcements_update" ON announcements
  FOR UPDATE TO authenticated
  USING (is_admin_or_officer())
  WITH CHECK (is_admin_or_officer());

-- Delete: admin/officer only
CREATE POLICY "announcements_delete" ON announcements
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- ============================================================================
-- EVENTS
-- ============================================================================
-- Read: published events
CREATE POLICY "events_select" ON events
  FOR SELECT TO authenticated
  USING (status = 'published');

-- Insert: admin/officer only
CREATE POLICY "events_insert" ON events
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_officer());

-- Update: admin/officer only
CREATE POLICY "events_update" ON events
  FOR UPDATE TO authenticated
  USING (is_admin_or_officer())
  WITH CHECK (is_admin_or_officer());

-- Delete: admin/officer only
CREATE POLICY "events_delete" ON events
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- ============================================================================
-- EVENT_ATTENDEES
-- ============================================================================
-- Read: all RSVPs
CREATE POLICY "attendees_select" ON event_attendees
  FOR SELECT TO authenticated
  USING (TRUE);

-- Insert: authenticated users can RSVP as themselves
CREATE POLICY "attendees_insert" ON event_attendees
  FOR INSERT TO authenticated
  WITH CHECK (member_id = current_member_id());

-- Update: own RSVP only
CREATE POLICY "attendees_update" ON event_attendees
  FOR UPDATE TO authenticated
  USING (member_id = current_member_id())
  WITH CHECK (member_id = current_member_id());

-- Delete: own RSVP only
CREATE POLICY "attendees_delete" ON event_attendees
  FOR DELETE TO authenticated
  USING (member_id = current_member_id());

-- ============================================================================
-- BIRTHDAY_CALENDAR
-- ============================================================================
-- Read: birthdays marked as shown
CREATE POLICY "birthdays_select" ON birthday_calendar
  FOR SELECT TO authenticated
  USING (show_on_calendar = TRUE);

-- Insert: admin/officer only
CREATE POLICY "birthdays_insert" ON birthday_calendar
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_officer());

-- Update: admin/officer only
CREATE POLICY "birthdays_update" ON birthday_calendar
  FOR UPDATE TO authenticated
  USING (is_admin_or_officer())
  WITH CHECK (is_admin_or_officer());

-- Delete: admin/officer only
CREATE POLICY "birthdays_delete" ON birthday_calendar
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- ============================================================================
-- MODERATION_REPORTS
-- ============================================================================
-- Read: admin/officer only
CREATE POLICY "reports_select" ON moderation_reports
  FOR SELECT TO authenticated
  USING (is_admin_or_officer());

-- Insert: any authenticated user can report content
CREATE POLICY "reports_insert" ON moderation_reports
  FOR INSERT TO authenticated
  WITH CHECK (current_member_id() IS NOT NULL);

-- Update: admin/officer only
CREATE POLICY "reports_update" ON moderation_reports
  FOR UPDATE TO authenticated
  USING (is_admin_or_officer())
  WITH CHECK (is_admin_or_officer());

-- Delete: admin/officer only
CREATE POLICY "reports_delete" ON moderation_reports
  FOR DELETE TO authenticated
  USING (is_admin_or_officer());

-- ============================================================================
-- SYSTEM_LOGS
-- ============================================================================
-- Read: admin/officer only
CREATE POLICY "logs_select" ON system_logs
  FOR SELECT TO authenticated
  USING (is_admin_or_officer());

-- Insert: any authenticated user (for audit logging)
CREATE POLICY "logs_insert" ON system_logs
  FOR INSERT TO authenticated
  WITH CHECK (current_member_id() IS NOT NULL);

-- ============================================================================
-- END OF RLS POLICIES
-- ============================================================================
