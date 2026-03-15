-- ============================================================================
-- Zeta Beta Mu Fraternity Portal Database Schema
-- ============================================================================
-- 
-- Description:
--   SQL database schema for the Zeta Beta Mu Fraternity medical professional
--   portal. Includes tables for members, posts, comments, alumni directory,
--   historical archives, and content management.
--
-- Database: MySQL 8.0+ / PostgreSQL 14+ compatible
-- Author: Zeta Beta Mu Fraternity IT Committee
-- Created: March 2026
-- ============================================================================

-- ============================================================================
-- TABLE: members
-- Description: Stores fraternity member information and authentication data
-- ============================================================================
CREATE TABLE members (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username            VARCHAR(50) NOT NULL UNIQUE,
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,           -- Bcrypt hashed password
    
    -- Personal Information
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    name                VARCHAR(200) GENERATED ALWAYS AS (CONCAT(first_name, ' ', last_name)) STORED,
    
    -- Professional Information
    graduation_year     YEAR NOT NULL,
    hospital            VARCHAR(255) NOT NULL,           -- Current hospital/institution
    field_of_medicine   VARCHAR(100) NOT NULL,         -- Medical specialty
    medical_license     VARCHAR(50),                    -- License number (optional)
    
    -- Profile
    bio                 TEXT,
    avatar_url          VARCHAR(500),
    phone               VARCHAR(20),
    
    -- Role & Status
    role                ENUM('admin', 'moderator', 'member', 'alumni') DEFAULT 'member',
    status              ENUM('active', 'pending', 'suspended', 'inactive') DEFAULT 'pending',
    verified_at         TIMESTAMP NULL,                  -- When admin verified the account
    
    -- Security
    email_verified_at   TIMESTAMP NULL,
    last_login_at       TIMESTAMP NULL,
    failed_login_attempts INT UNSIGNED DEFAULT 0,
    locked_until        TIMESTAMP NULL,
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP NULL,                  -- Soft delete
    
    -- Indexes
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_status (status),
    INDEX idx_graduation_year (graduation_year),
    INDEX idx_field (field_of_medicine),
    INDEX idx_hospital (hospital),
    INDEX idx_verified (verified_at),
    FULLTEXT idx_search (name, hospital, field_of_medicine)  -- For search functionality
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: posts
-- Description: Social feed posts made by members
-- ============================================================================
CREATE TABLE posts (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id           BIGINT UNSIGNED NOT NULL,
    
    -- Content
    content             TEXT NOT NULL,
    content_html        TEXT,                            -- Sanitized HTML version
    
    -- Media
    image_url           VARCHAR(500),
    video_url           VARCHAR(500),
    attachment_url      VARCHAR(500),                    -- PDF or document attachments
    
    -- Engagement
    likes_count         INT UNSIGNED DEFAULT 0,
    comments_count      INT UNSIGNED DEFAULT 0,
    shares_count        INT UNSIGNED DEFAULT 0,
    
    -- Status
    status              ENUM('published', 'draft', 'archived', 'reported', 'removed') DEFAULT 'published',
    is_pinned           BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP NULL,                  -- Soft delete
    
    -- Foreign Keys
    CONSTRAINT fk_posts_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_member (member_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at DESC),
    INDEX idx_pinned (is_pinned, created_at DESC),
    FULLTEXT idx_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: comments
-- Description: Comments on posts
-- ============================================================================
CREATE TABLE comments (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_id             BIGINT UNSIGNED NOT NULL,
    member_id           BIGINT UNSIGNED NOT NULL,
    parent_id           BIGINT UNSIGNED NULL,            -- For threaded replies
    
    -- Content
    content             TEXT NOT NULL,
    content_html        TEXT,                            -- Sanitized HTML
    
    -- Engagement
    likes_count         INT UNSIGNED DEFAULT 0,
    
    -- Status
    status              ENUM('published', 'reported', 'removed') DEFAULT 'published',
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP NULL,
    
    -- Foreign Keys
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_post (post_id),
    INDEX idx_member (member_id),
    INDEX idx_parent (parent_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: post_reactions
-- Description: Likes/reactions on posts (prevents duplicate likes)
-- ============================================================================
CREATE TABLE post_reactions (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_id             BIGINT UNSIGNED NOT NULL,
    member_id           BIGINT UNSIGNED NOT NULL,
    reaction_type       ENUM('like', 'love', 'celebrate', 'insightful') DEFAULT 'like',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_reactions_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_reactions_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate reactions
    UNIQUE KEY unique_reaction (post_id, member_id),
    
    -- Indexes
    INDEX idx_post (post_id),
    INDEX idx_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: magazines (Traditions)
-- Description: Digital archive of yearly fraternity magazines
-- ============================================================================
CREATE TABLE magazines (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    year                YEAR NOT NULL,
    title               VARCHAR(255) NOT NULL,
    subtitle            VARCHAR(255),
    
    -- Content
    description         TEXT,
    cover_image_url     VARCHAR(500) NOT NULL,
    pdf_url             VARCHAR(500) NOT NULL,
    page_count          INT UNSIGNED,
    
    -- Metadata
    editor_id           BIGINT UNSIGNED,                 -- Lead editor (member)
    published_at        DATE,
    is_published        BOOLEAN DEFAULT TRUE,
    
    -- Engagement
    download_count      INT UNSIGNED DEFAULT 0,
    view_count          INT UNSIGNED DEFAULT 0,
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_magazines_editor FOREIGN KEY (editor_id) REFERENCES members(id) ON SET NULL,
    
    -- Indexes
    UNIQUE KEY unique_year (year),
    INDEX idx_year (year DESC),
    INDEX idx_published (is_published, year DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: vault_items (Historical Vault)
-- Description: Historical photos and documents archive (1971-2026)
-- ============================================================================
CREATE TABLE vault_items (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    year                YEAR NOT NULL,
    
    -- Content
    title               VARCHAR(255) NOT NULL,
    caption             TEXT,
    media_url           VARCHAR(500) NOT NULL,
    thumbnail_url       VARCHAR(500),
    
    -- Type & Category
    item_type           ENUM('photo', 'document', 'video', 'audio') DEFAULT 'photo',
    category            ENUM('gala', 'induction', 'conference', 'reunion', 'mission', 
                            'graduation', 'founders_day', 'other') DEFAULT 'other',
    
    -- Metadata
    event_date          DATE,
    location            VARCHAR(255),
    uploaded_by         BIGINT UNSIGNED NOT NULL,
    
    -- Status
    is_featured         BOOLEAN DEFAULT FALSE,
    is_public           BOOLEAN DEFAULT TRUE,            -- Public vs members-only
    
    -- Engagement
    view_count          INT UNSIGNED DEFAULT 0,
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP NULL,
    
    -- Foreign Keys
    CONSTRAINT fk_vault_uploader FOREIGN KEY (uploaded_by) REFERENCES members(id) ON DELETE RESTRICT,
    
    -- Indexes
    INDEX idx_year (year DESC),
    INDEX idx_category (category),
    INDEX idx_type (item_type),
    INDEX idx_featured (is_featured),
    INDEX idx_uploaded (uploaded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: announcements
-- Description: Important fraternity announcements and news
-- ============================================================================
CREATE TABLE announcements (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    content             TEXT NOT NULL,
    content_html        TEXT,
    
    -- Metadata
    author_id           BIGINT UNSIGNED NOT NULL,
    priority            ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    
    -- Visibility
    is_pinned           BOOLEAN DEFAULT FALSE,
    starts_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at          TIMESTAMP NULL,
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP NULL,
    
    -- Foreign Keys
    CONSTRAINT fk_announcements_author FOREIGN KEY (author_id) REFERENCES members(id) ON DELETE RESTRICT,
    
    -- Indexes
    INDEX idx_priority (priority),
    INDEX idx_pinned (is_pinned),
    INDEX idx_dates (starts_at, expires_at),
    INDEX idx_active (starts_at, expires_at, deleted_at)  -- For active announcements query
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: events
-- Description: Fraternity events and calendar
-- ============================================================================
CREATE TABLE events (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
    organizer_id        BIGINT UNSIGNED NOT NULL,
    max_attendees       INT UNSIGNED,
    
    -- Status
    status              ENUM('draft', 'published', 'cancelled', 'completed') DEFAULT 'draft',
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) REFERENCES members(id) ON DELETE RESTRICT,
    
    -- Indexes
    INDEX idx_event_date (event_date),
    INDEX idx_status (status),
    INDEX idx_organizer (organizer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: event_attendees
-- Description: RSVP tracking for events
-- ============================================================================
CREATE TABLE event_attendees (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id            BIGINT UNSIGNED NOT NULL,
    member_id           BIGINT UNSIGNED NOT NULL,
    
    -- RSVP Status
    status              ENUM('going', 'maybe', 'not_going', 'waitlist') DEFAULT 'going',
    guests_count        INT UNSIGNED DEFAULT 0,
    dietary_requirements VARCHAR(255),
    notes               TEXT,
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_attendees_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendees_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    
    -- Unique constraint
    UNIQUE KEY unique_attendee (event_id, member_id),
    
    -- Indexes
    INDEX idx_event (event_id),
    INDEX idx_member (member_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: birthday_calendar
-- Description: Tracks member birthdays for the birthday widget
-- ============================================================================
CREATE TABLE birthday_calendar (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id           BIGINT UNSIGNED NOT NULL UNIQUE,
    birth_date          DATE NOT NULL,                   -- Month and day only (year optional)
    birth_year          YEAR,                            -- Optional for age calculation
    
    -- Privacy
    show_age            BOOLEAN DEFAULT FALSE,
    show_on_calendar    BOOLEAN DEFAULT TRUE,
    
    -- Notifications
    last_celebrated_at  TIMESTAMP NULL,
    
    -- Foreign Keys
    CONSTRAINT fk_birthday_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_birth_date (birth_date)  -- For efficient birthday queries
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: moderation_reports
-- Description: Tracks reported content for moderation
-- ============================================================================
CREATE TABLE moderation_reports (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reporter_id         BIGINT UNSIGNED NOT NULL,
    
    -- Reported Content Reference
    content_type        ENUM('post', 'comment', 'profile', 'message') NOT NULL,
    content_id          BIGINT UNSIGNED NOT NULL,
    
    -- Report Details
    reason              ENUM('spam', 'harassment', 'inappropriate', 'misinformation', 
                            'copyright', 'other') NOT NULL,
    description         TEXT,
    
    -- Status
    status              ENUM('pending', 'investigating', 'resolved', 'dismissed') DEFAULT 'pending',
    resolved_by         BIGINT UNSIGNED NULL,
    resolved_at         TIMESTAMP NULL,
    resolution_notes    TEXT,
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES members(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reports_resolver FOREIGN KEY (resolved_by) REFERENCES members(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_content (content_type, content_id),
    INDEX idx_status (status),
    INDEX idx_reporter (reporter_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: system_logs
-- Description: Audit trail for security and troubleshooting
-- ============================================================================
CREATE TABLE system_logs (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    
    -- Event Details
    event_type          VARCHAR(50) NOT NULL,
    severity            ENUM('debug', 'info', 'warning', 'error', 'critical') DEFAULT 'info',
    message             TEXT NOT NULL,
    
    -- Actor
    member_id           BIGINT UNSIGNED NULL,            -- NULL for system events
    ip_address          VARCHAR(45),                     -- IPv6 compatible
    user_agent          VARCHAR(500),
    
    -- Context
    entity_type         VARCHAR(50),                     -- e.g., 'post', 'member'
    entity_id           BIGINT UNSIGNED,
    metadata            JSON,                            -- Additional context
    
    -- Timestamp
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_logs_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_event_type (event_type),
    INDEX idx_severity (severity),
    INDEX idx_created (created_at DESC),
    INDEX idx_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active members with profile info
CREATE VIEW v_active_members AS
SELECT 
    id, username, email, name, first_name, last_name,
    graduation_year, hospital, field_of_medicine,
    role, status, avatar_url, bio, verified_at, last_login_at, created_at
FROM members
WHERE status = 'active' AND deleted_at IS NULL;

-- View: Today's birthdays
CREATE VIEW v_todays_birthdays AS
SELECT 
    m.id, m.name, m.avatar_url, m.graduation_year,
    bc.birth_date, bc.birth_year
FROM members m
JOIN birthday_calendar bc ON m.id = bc.member_id
WHERE 
    bc.show_on_calendar = TRUE
    AND MONTH(bc.birth_date) = MONTH(CURRENT_DATE)
    AND DAY(bc.birth_date) = DAY(CURRENT_DATE)
    AND m.status = 'active'
    AND m.deleted_at IS NULL;

-- View: Upcoming events with attendee count
CREATE VIEW v_upcoming_events AS
SELECT 
    e.*,
    m.name as organizer_name,
    COUNT(ea.id) as attendee_count
FROM events e
JOIN members m ON e.organizer_id = m.id
LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.status = 'going'
WHERE e.event_date >= CURRENT_DATE
    AND e.status IN ('published', 'draft')
GROUP BY e.id
ORDER BY e.event_date ASC;

-- ============================================================================
-- STORED PROCEDURES (Optional - for complex operations)
-- ============================================================================

DELIMITER //

-- Procedure: Search alumni directory
CREATE PROCEDURE sp_search_directory(
    IN p_query VARCHAR(255),
    IN p_field VARCHAR(100),
    IN p_year INT
)
BEGIN
    SELECT 
        id, name, graduation_year, hospital, field_of_medicine, avatar_url
    FROM members
    WHERE status = 'active'
        AND deleted_at IS NULL
        AND (
            p_query IS NULL OR p_query = ''
            OR MATCH(name, hospital, field_of_medicine) AGAINST(p_query IN NATURAL LANGUAGE MODE)
            OR name LIKE CONCAT('%', p_query, '%')
            OR hospital LIKE CONCAT('%', p_query, '%')
        )
        AND (p_field IS NULL OR p_field = '' OR field_of_medicine = p_field)
        AND (p_year IS NULL OR p_year = 0 OR graduation_year = p_year)
    ORDER BY name ASC
    LIMIT 50;
END //

-- Procedure: Get posts for feed with pagination
CREATE PROCEDURE sp_get_feed(
    IN p_offset INT,
    IN p_limit INT
)
BEGIN
    SELECT 
        p.*,
        m.name as author_name,
        m.avatar_url as author_avatar,
        m.hospital as author_title
    FROM posts p
    JOIN members m ON p.member_id = m.id
    WHERE p.status = 'published'
        AND p.deleted_at IS NULL
        AND m.status = 'active'
    ORDER BY p.is_pinned DESC, p.created_at DESC
    LIMIT p_offset, p_limit;
END //

DELIMITER ;

-- ============================================================================
-- INITIAL DATA (Optional seed data)
-- ============================================================================

-- Insert default admin user (password should be hashed in production)
-- NOTE: This is for development only. In production, use proper password hashing.
-- INSERT INTO members (username, email, password_hash, first_name, last_name, 
--                      graduation_year, hospital, field_of_medicine, role, status, verified_at)
-- VALUES ('admin', 'admin@zetabetamu.com', '$2y$10$...', 'System', 'Administrator', 
--         1995, 'St. Luke\'s Medical Center', 'Cardiology', 'admin', 'active', NOW());

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
