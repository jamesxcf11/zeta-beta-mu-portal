-- ============================================================================
-- Zeta Beta Mu Fraternity Portal Database Schema (PostgreSQL / Supabase)
-- ============================================================================
--
-- Converted from sql/schema.sql (MySQL 8.0+ / PostgreSQL 14+ compatible)
-- for use with Supabase free tier.
--
-- Key changes from MySQL version:
--   - AUTO_INCREMENT → GENERATED ALWAYS AS IDENTITY
--   - Removed ENGINE=InnoDB, CHARSET, COLLATE clauses
--   - ENUM → VARCHAR with CHECK constraint
--   - YEAR → INTEGER with CHECK (1900-2100)
--   - FULLTEXT index → GIN index on tsvector
--   - ON UPDATE CURRENT_TIMESTAMP → trigger function
--   - BIGINT UNSIGNED → BIGINT
-- ============================================================================

-- ============================================================================
-- HELPER: updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENUM TYPES (PostgreSQL native enums)
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('admin', 'moderator', 'member', 'alumni', 'officer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE member_status AS ENUM ('active', 'pending', 'suspended', 'inactive', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('published', 'draft', 'archived', 'reported', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE comment_status AS ENUM ('published', 'reported', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE reaction_type AS ENUM ('like', 'love', 'celebrate', 'insightful', 'support', 'haha');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE vault_item_type AS ENUM ('photo', 'document', 'video', 'audio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE vault_category AS ENUM ('gala', 'induction', 'conference', 'reunion', 'mission', 'graduation', 'founders_day', 'other', 'research', 'charity_mission', 'annual_gala');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE announcement_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE rsvp_status AS ENUM ('going', 'maybe', 'not_going', 'waitlist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE report_reason AS ENUM ('spam', 'harassment', 'inappropriate', 'misinformation', 'copyright', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'investigating', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE log_severity AS ENUM ('debug', 'info', 'warning', 'error', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE vault_approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLE: members
-- ============================================================================
CREATE TABLE IF NOT EXISTS members (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username            VARCHAR(50) NOT NULL UNIQUE,
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,

    -- Personal Information
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    middle_name         VARCHAR(100),
    nickname            VARCHAR(100),

    -- Professional Information
    graduation_year     INTEGER NOT NULL CHECK (graduation_year BETWEEN 1900 AND 2100),
    hospital            VARCHAR(255) NOT NULL,
    field_of_medicine   VARCHAR(100) NOT NULL,
    medical_license     VARCHAR(50),
    specialization      VARCHAR(255),
    batch               VARCHAR(50),

    -- Profile
    bio                 TEXT,
    avatar_url          VARCHAR(500),
    phone               VARCHAR(20),
    mobile              VARCHAR(20),
    telephone           VARCHAR(20),
    home_phone          VARCHAR(20),
    facebook            VARCHAR(255),
    instagram           VARCHAR(255),
    address             TEXT,
    birthday            DATE,

    -- Role & Status
    role                member_role DEFAULT 'member',
    status              member_status DEFAULT 'pending',
    verified_at         TIMESTAMPTZ NULL,

    -- Security
    auth_id             UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    email_verified_at   TIMESTAMPTZ NULL,
    last_login_at       TIMESTAMPTZ NULL,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until        TIMESTAMPTZ NULL,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ NULL
);

-- Generated column for full name
ALTER TABLE members ADD COLUMN IF NOT EXISTS name VARCHAR(200)
    GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(NULLIF(middle_name, ''), '') || ' ' || last_name)) STORED;

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_graduation_year ON members(graduation_year);
CREATE INDEX IF NOT EXISTS idx_members_field ON members(field_of_medicine);
CREATE INDEX IF NOT EXISTS idx_members_auth_id ON members(auth_id);
CREATE INDEX IF NOT EXISTS idx_members_hospital ON members(hospital);
CREATE INDEX IF NOT EXISTS idx_members_verified ON members(verified_at);
CREATE INDEX IF NOT EXISTS idx_members_search ON members USING gin(to_tsvector('english', name || ' ' || hospital || ' ' || field_of_medicine));

CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: posts
-- ============================================================================
CREATE TABLE IF NOT EXISTS posts (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id           BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,

    -- Content
    content             TEXT NOT NULL,
    content_html        TEXT,

    -- Media
    image_url           VARCHAR(500),
    video_url           VARCHAR(500),
    attachment_url      VARCHAR(500),

    -- Engagement
    likes_count         INTEGER DEFAULT 0,
    comments_count      INTEGER DEFAULT 0,
    shares_count        INTEGER DEFAULT 0,

    -- Status
    status              post_status DEFAULT 'published',
    is_pinned           BOOLEAN DEFAULT FALSE,
    post_type           VARCHAR(50) DEFAULT 'general',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_member ON posts(member_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts(is_pinned, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_content ON posts USING gin(to_tsvector('english', content));

CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id             BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    member_id           BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    parent_id           BIGINT REFERENCES comments(id) ON DELETE CASCADE,

    -- Content
    content             TEXT NOT NULL,
    content_html        TEXT,

    -- Engagement
    likes_count         INTEGER DEFAULT 0,

    -- Status
    status              comment_status DEFAULT 'published',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_member ON comments(member_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);

CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: post_reactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_reactions (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id             BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    member_id           BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    reaction_type       reaction_type DEFAULT 'like',
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (post_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_post ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_member ON post_reactions(member_id);

-- ============================================================================
-- TABLE: magazines (Traditions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS magazines (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    year                INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),
    title               VARCHAR(255) NOT NULL,
    subtitle            VARCHAR(255),

    -- Content
    description         TEXT,
    cover_image_url     VARCHAR(500) NOT NULL,
    pdf_url             VARCHAR(500) NOT NULL,
    page_count          INTEGER,

    -- Metadata
    editor_id           BIGINT REFERENCES members(id) ON DELETE SET NULL,
    published_at        DATE,
    is_published        BOOLEAN DEFAULT TRUE,

    -- Engagement
    download_count      INTEGER DEFAULT 0,
    view_count          INTEGER DEFAULT 0,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (year)
);

CREATE INDEX IF NOT EXISTS idx_magazines_year ON magazines(year DESC);
CREATE INDEX IF NOT EXISTS idx_magazines_published ON magazines(is_published, year DESC);
CREATE INDEX IF NOT EXISTS idx_magazines_editor ON magazines(editor_id);

CREATE TRIGGER trg_magazines_updated_at BEFORE UPDATE ON magazines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: vault_items (Historical Vault)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vault_items (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    album_id            VARCHAR(100),
    year                INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),

    -- Content
    title               VARCHAR(255) NOT NULL,
    caption             TEXT,
    media_url           VARCHAR(500) NOT NULL,
    thumbnail_url       VARCHAR(500),

    -- Type & Category
    item_type           vault_item_type DEFAULT 'photo',
    category            vault_category DEFAULT 'other',

    -- Metadata
    event_date          DATE,
    location            VARCHAR(255),
    uploaded_by         BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,

    -- Status
    is_featured         BOOLEAN DEFAULT FALSE,
    is_public           BOOLEAN DEFAULT TRUE,
    approval_status     vault_approval_status DEFAULT 'pending',

    -- Engagement
    view_count          INTEGER DEFAULT 0,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_vault_year ON vault_items(year DESC);
CREATE INDEX IF NOT EXISTS idx_vault_category ON vault_items(category);
CREATE INDEX IF NOT EXISTS idx_vault_type ON vault_items(item_type);
CREATE INDEX IF NOT EXISTS idx_vault_featured ON vault_items(is_featured);
CREATE INDEX IF NOT EXISTS idx_vault_uploaded ON vault_items(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_vault_album ON vault_items(album_id);

CREATE TRIGGER trg_vault_updated_at BEFORE UPDATE ON vault_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: announcements
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcements (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    content             TEXT NOT NULL,
    content_html        TEXT,

    -- Metadata
    author_id           BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    priority            announcement_priority DEFAULT 'normal',

    -- Visibility
    is_pinned           BOOLEAN DEFAULT FALSE,
    starts_at           TIMESTAMPTZ DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NULL,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON announcements(starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_author ON announcements(author_id);

CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: events
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,

    -- Timing
    event_date          DATE NOT NULL,
    start_time          TIME,
    end_time            TIME,
    timezone            VARCHAR(50) DEFAULT 'America/New_York',

    -- Location
    location            VARCHAR(255),
    address             TEXT,
    is_virtual          BOOLEAN DEFAULT FALSE,
    virtual_link        VARCHAR(500),

    -- Metadata
    organizer_id        BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    max_attendees       INTEGER,

    -- Status
    status              event_status DEFAULT 'draft',

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);

CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: event_attendees
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_attendees (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id            BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    member_id           BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,

    -- RSVP Status
    status              rsvp_status DEFAULT 'going',
    guests_count        INTEGER DEFAULT 0,
    dietary_requirements VARCHAR(255),
    notes               TEXT,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (event_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_member ON event_attendees(member_id);
CREATE INDEX IF NOT EXISTS idx_attendees_status ON event_attendees(status);

CREATE TRIGGER trg_attendees_updated_at BEFORE UPDATE ON event_attendees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: birthday_calendar
-- ============================================================================
CREATE TABLE IF NOT EXISTS birthday_calendar (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id           BIGINT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    birth_date          DATE NOT NULL,
    birth_year          INTEGER CHECK (birth_year BETWEEN 1900 AND 2100),

    -- Privacy
    show_age            BOOLEAN DEFAULT FALSE,
    show_on_calendar    BOOLEAN DEFAULT TRUE,

    -- Notifications
    last_celebrated_at  TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_birthday_date ON birthday_calendar(birth_date);

-- ============================================================================
-- TABLE: moderation_reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS moderation_reports (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporter_id         BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,

    -- Reported Content Reference
    content_type        VARCHAR(50) NOT NULL CHECK (content_type IN ('post', 'comment', 'profile', 'message')),
    content_id          BIGINT NOT NULL,

    -- Report Details
    reason              report_reason NOT NULL,
    description         TEXT,

    -- Status
    status              report_status DEFAULT 'pending',
    resolved_by         BIGINT REFERENCES members(id) ON DELETE SET NULL,
    resolved_at         TIMESTAMPTZ NULL,
    resolution_notes    TEXT,

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_content ON moderation_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON moderation_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON moderation_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_resolved_by ON moderation_reports(resolved_by);
CREATE INDEX IF NOT EXISTS idx_reports_created ON moderation_reports(created_at);

-- ----------------------------------------------------------------------------
-- SHELL (enable once Supabase project is provisioned):
-- content_type/content_id is a polymorphic reference (post|comment|profile|message)
-- and cannot be a real FK. Once the cloud DB is live, uncomment and adapt this
-- trigger to validate content_id actually exists in the referenced table before
-- insert/update, preventing orphaned moderation reports.
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION validate_moderation_report_content()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NEW.content_type = 'post' AND NOT EXISTS (SELECT 1 FROM posts WHERE id = NEW.content_id) THEN
--         RAISE EXCEPTION 'Invalid content_id: no post with id %', NEW.content_id;
--     ELSIF NEW.content_type = 'comment' AND NOT EXISTS (SELECT 1 FROM comments WHERE id = NEW.content_id) THEN
--         RAISE EXCEPTION 'Invalid content_id: no comment with id %', NEW.content_id;
--     ELSIF NEW.content_type = 'profile' AND NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.content_id) THEN
--         RAISE EXCEPTION 'Invalid content_id: no member with id %', NEW.content_id;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER trg_validate_moderation_report_content
--     BEFORE INSERT OR UPDATE ON moderation_reports
--     FOR EACH ROW EXECUTE FUNCTION validate_moderation_report_content();

CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON moderation_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: system_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Event Details
    event_type          VARCHAR(50) NOT NULL,
    severity            log_severity DEFAULT 'info',
    message             TEXT NOT NULL,

    -- Actor
    member_id           BIGINT REFERENCES members(id) ON DELETE SET NULL,
    ip_address          VARCHAR(45),
    user_agent          VARCHAR(500),

    -- Context
    entity_type         VARCHAR(50),
    entity_id           BIGINT,
    metadata            JSONB,

    -- Timestamp
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_event_type ON system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_member ON system_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON system_logs(entity_type, entity_id);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active members with profile info
CREATE OR REPLACE VIEW v_active_members AS
SELECT
    id, username, email, name, first_name, last_name,
    graduation_year, hospital, field_of_medicine,
    role, status, avatar_url, bio, verified_at, last_login_at, created_at
FROM members
WHERE status = 'active' AND deleted_at IS NULL;

-- View: Today's birthdays
CREATE OR REPLACE VIEW v_todays_birthdays AS
SELECT
    m.id, m.name, m.avatar_url, m.graduation_year,
    bc.birth_date, bc.birth_year
FROM members m
JOIN birthday_calendar bc ON m.id = bc.member_id
WHERE
    bc.show_on_calendar = TRUE
    AND EXTRACT(MONTH FROM bc.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM bc.birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
    AND m.status = 'active'
    AND m.deleted_at IS NULL;

-- View: Upcoming events with attendee count
CREATE OR REPLACE VIEW v_upcoming_events AS
SELECT
    e.*,
    m.name as organizer_name,
    COUNT(ea.id) as attendee_count
FROM events e
JOIN members m ON e.organizer_id = m.id
LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.status = 'going'
WHERE e.event_date >= CURRENT_DATE
    AND e.status IN ('published', 'draft')
GROUP BY e.id, m.name
ORDER BY e.event_date ASC;

-- ============================================================================
-- MIGRATION NOTES (for existing databases)
-- ============================================================================
-- If the schema was already created without 'rejected' in member_status,
-- run this to add it:
--   ALTER TYPE member_status ADD VALUE IF NOT EXISTS 'rejected' BEFORE 'inactive';
--
-- If adding the auth_id column to members for RLS ownership policies:
--   ALTER TABLE members ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
--   CREATE INDEX IF NOT EXISTS idx_members_auth_id ON members(auth_id);
-- ============================================================================

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
