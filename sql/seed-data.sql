-- ============================================================================
-- Zeta Beta Mu Fraternity Portal — Seed Data
-- ============================================================================
-- Run AFTER schema-postgres.sql in the Supabase SQL Editor.
-- Inserts demo members, posts, comments, vault items, and announcements
-- that match the current mock data in the JS files.
-- ============================================================================

-- Clear any partial data from previous failed runs
TRUNCATE TABLE post_reactions, comments, posts, vault_items, announcements, birthday_calendar, events, event_attendees, moderation_reports, system_logs CASCADE;
TRUNCATE TABLE members RESTART IDENTITY CASCADE;

-- MEMBERS (from js/auth.js mockUsers + js/directory.js members)
INSERT INTO members (id, username, email, password_hash, first_name, last_name, graduation_year, hospital, field_of_medicine, role, status, avatar_url, verified_at, created_at) OVERRIDING SYSTEM VALUE
VALUES
(1, 'admin', 'james@zetabetamu.com', '$2a$10$placeholder', 'James', 'Anderson', 1995, 'St. Luke''s Medical Center', 'Cardiology', 'admin', 'active', 'image/placeholders/avatars/a11.jpg', NOW(), '1995-06-15'),
(2, 'doctor1', 'sarah@zetabetamu.com', '$2a$10$placeholder', 'Sarah', 'Mitchell', 2008, 'Mount Sinai Hospital', 'Neurology', 'member', 'active', 'image/placeholders/avatars/a5.jpg', NOW(), '2008-06-20'),
(3, 'doctor2', 'michael@zetabetamu.com', '$2a$10$placeholder', 'Michael', 'Chen', 2012, 'Johns Hopkins Medicine', 'Oncology', 'member', 'active', 'image/placeholders/avatars/a3.jpg', NOW(), '2012-06-18'),
(4, 'doctor3', 'emily@zetabetamu.com', '$2a$10$placeholder', 'Emily', 'Roberts', 2015, 'Children''s Hospital', 'Pediatrics', 'member', 'active', 'image/placeholders/avatars/a9.jpg', NOW(), '2015-06-22'),
(5, 'doctor4', 'robert@zetabetamu.com', '$2a$10$placeholder', 'Robert', 'Kim', 2002, 'Mayo Clinic', 'Surgery', 'member', 'active', 'image/placeholders/avatars/a8.jpg', NOW(), '2002-06-15'),
(6, 'doctor5', 'lisa@zetabetamu.com', '$2a$10$placeholder', 'Lisa', 'Wang', 2010, 'Cleveland Clinic', 'Cardiology', 'member', 'active', 'image/placeholders/avatars/a10.jpg', NOW(), '2010-06-18'),
(7, 'doctor6', 'david@zetabetamu.com', '$2a$10$placeholder', 'David', 'Martinez', 2018, 'UCLA Medical Center', 'Orthopedics', 'member', 'active', 'image/placeholders/avatars/a12.jpg', NOW(), '2018-06-20'),
(8, 'doctor7', 'jennifer@zetabetamu.com', '$2a$10$placeholder', 'Jennifer', 'Adams', 2005, 'NYU Langone Health', 'Dermatology', 'member', 'active', 'image/placeholders/avatars/a6.jpg', NOW(), '2005-06-15'),
(9, 'doctor8', 'william@zetabetamu.com', '$2a$10$placeholder', 'William', 'Turner', 1998, 'Stanford Health Care', 'Psychiatry', 'member', 'active', 'image/placeholders/avatars/a13.jpg', NOW(), '1998-06-18'),
(10, 'doctor9', 'amanda@zetabetamu.com', '$2a$10$placeholder', 'Amanda', 'Foster', 2011, 'Mass General Brigham', 'Internal Medicine', 'member', 'active', 'image/placeholders/avatars/a7.jpg', NOW(), '2011-06-20'),
(11, 'doctor10', 'christopher@zetabetamu.com', '$2a$10$placeholder', 'Christopher', 'Lee', 2007, 'Cedars-Sinai', 'Emergency Medicine', 'member', 'active', 'image/placeholders/avatars/a14.jpg', NOW(), '2007-06-15'),
(12, 'doctor11', 'michelle@zetabetamu.com', '$2a$10$placeholder', 'Michelle', 'Park', 2014, 'UCSF Medical Center', 'Radiology', 'member', 'active', 'image/placeholders/avatars/a15.jpg', NOW(), '2014-06-18')
ON CONFLICT (id) DO NOTHING;

-- Advance the identity sequence past the explicit IDs above
-- (OVERRIDING SYSTEM VALUE inserts do not advance the sequence)
SELECT setval('members_id_seq', (SELECT MAX(id) FROM members));

-- PENDING MEMBERS (from js/admin.js)
INSERT INTO members (username, email, password_hash, first_name, last_name, graduation_year, hospital, field_of_medicine, role, status, created_at)
VALUES
('alex.thompson', 'alex@hospital.com', '$2a$10$placeholder', 'Alex', 'Thompson', 2019, 'Northwestern Medicine', 'Cardiology', 'member', 'pending', '2026-03-10'),
('maria.garcia', 'maria@clinic.com', '$2a$10$placeholder', 'Maria', 'Garcia', 2020, 'Rush University Medical', 'Pediatrics', 'member', 'pending', '2026-03-11'),
('kevin.liu', 'kevin@health.org', '$2a$10$placeholder', 'Kevin', 'Liu', 2018, 'Cleveland Clinic', 'Surgery', 'member', 'pending', '2026-03-12')
ON CONFLICT (username) DO NOTHING;

-- POSTS (from js/feed.js)
INSERT INTO posts (id, member_id, content, image_url, is_pinned, post_type, status, created_at) OVERRIDING SYSTEM VALUE
VALUES
(1, 2, 'Just published our latest research on neuroplasticity in stroke recovery. Excited to share these findings with our medical community! The study followed 200 patients over 18 months and shows remarkable improvement potential with targeted therapy protocols.', 'image/placeholders/picsum/p1.jpg', TRUE, 'achievement', 'published', NOW() - INTERVAL '2 hours'),
(2, 3, 'Honored to be speaking at the Annual Oncology Summit next month. Looking forward to reconnecting with fellow Zeta Beta Mu brothers at the event! Who else is attending?', NULL, FALSE, 'achievement', 'published', NOW() - INTERVAL '5 hours'),
(3, 1, 'Reminder: The Annual Fraternity Gala Dinner is scheduled for March 25th at The Grand Hotel. Please RSVP by March 10th. This year''s theme is "Honoring 55 Years of Excellence." Looking forward to seeing everyone there!', 'image/placeholders/picsum/p2.jpg', FALSE, 'announcement', 'published', NOW() - INTERVAL '1 day'),
(4, 4, 'Congratulations to our newest inductees! Welcome to the brotherhood, Dr. Martinez, Dr. Patel, and Dr. Wong. Your dedication to medicine and service is truly inspiring.', NULL, FALSE, 'achievement', 'published', NOW() - INTERVAL '2 days'),
(5, 5, 'Sharing a case study from yesterday: 6-hour complex cardiac surgery on a 72-year-old patient. Successful outcome thanks to the incredible team at Mayo. Grateful for the expertise honed through years of practice and the support of mentors from Zeta Beta Mu.', NULL, FALSE, 'case_study', 'published', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

SELECT setval('posts_id_seq', (SELECT MAX(id) FROM posts));

-- COMMENTS (from js/feed.js)
INSERT INTO comments (id, post_id, member_id, content, created_at) OVERRIDING SYSTEM VALUE
VALUES
(1, 1, 3, 'Congratulations Dr. Mitchell! This is groundbreaking work.', NOW() - INTERVAL '1 hour'),
(2, 1, 1, 'Would love to discuss the methodology. Great job!', NOW() - INTERVAL '30 minutes'),
(3, 2, 4, 'I will be there! Let''s grab coffee between sessions.', NOW() - INTERVAL '4 hours'),
(4, 4, 7, 'Thank you so much! Honored to be part of this amazing fraternity.', NOW() - INTERVAL '1.5 days'),
(5, 5, 1, 'Excellent work, Dr. Kim! The patient is fortunate to have you.', NOW() - INTERVAL '2.5 days'),
(6, 5, 2, 'Proud of our brother! This is what excellence looks like.', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

SELECT setval('comments_id_seq', (SELECT MAX(id) FROM comments));

UPDATE posts SET comments_count = 2 WHERE id = 1;
UPDATE posts SET comments_count = 1 WHERE id = 2;
UPDATE posts SET comments_count = 1 WHERE id = 4;
UPDATE posts SET comments_count = 2 WHERE id = 5;

-- POST REACTIONS
INSERT INTO post_reactions (post_id, member_id, reaction_type)
VALUES
(1, 1, 'love'), (1, 2, 'celebrate'), (1, 3, 'celebrate'), (1, 4, 'love'),
(1, 5, 'celebrate'), (1, 6, 'insightful'), (1, 7, 'celebrate'), (1, 8, 'love'),
(2, 1, 'celebrate'), (2, 2, 'love'), (2, 3, 'like'), (2, 4, 'celebrate'),
(2, 5, 'love'), (2, 6, 'celebrate'), (2, 7, 'insightful'),
(3, 1, 'celebrate'), (3, 2, 'love'), (3, 3, 'celebrate'), (3, 4, 'love'),
(3, 5, 'celebrate'), (3, 6, 'insightful'), (3, 7, 'celebrate'),
(4, 1, 'love'), (4, 2, 'celebrate'), (4, 3, 'love'), (4, 4, 'celebrate'),
(4, 5, 'love'), (4, 6, 'celebrate'), (4, 7, 'insightful'),
(5, 1, 'love'), (5, 2, 'celebrate'), (5, 3, 'insightful'), (5, 4, 'love'),
(5, 5, 'celebrate'), (5, 6, 'insightful'), (5, 7, 'love')
ON CONFLICT (post_id, member_id) DO NOTHING;

-- ANNOUNCEMENTS (from js/feed.js)
INSERT INTO announcements (id, title, content, author_id, priority, is_pinned, starts_at, created_at) OVERRIDING SYSTEM VALUE
VALUES
(1, 'Annual Gala 2026', 'Join us for our 55th anniversary celebration at The Grand Hotel.', 1, 'high', TRUE, '2026-01-01', '2026-01-15'),
(2, 'New Member Induction', 'Ceremony for 12 new medical professionals joining the brotherhood.', 1, 'normal', FALSE, '2026-02-01', '2026-02-20'),
(3, 'Medical Conference', 'Annual medical excellence conference — registration opens next week.', 1, 'normal', FALSE, '2026-03-01', '2026-03-01'),
(4, 'Officer Elections', 'Nominate qualified brothers for the upcoming officer elections.', 1, 'normal', FALSE, '2026-04-01', '2026-04-01'),
(5, 'Alumni Outreach Drive', 'Help reconnect with alumni and update contact records before the gala.', 1, 'low', FALSE, '2026-04-15', '2026-04-15'),
(6, 'Community Clinic Day', 'Volunteer for the annual free community clinic day at St. Luke''s.', 1, 'high', FALSE, '2026-05-01', '2026-05-01'),
(7, 'Scholarship Fundraiser', 'Support the next generation of medical leaders through our scholarship fund.', 1, 'normal', FALSE, '2026-06-01', '2026-06-01')
ON CONFLICT (id) DO NOTHING;

SELECT setval('announcements_id_seq', (SELECT MAX(id) FROM announcements));

-- VAULT ITEMS — Villa Maria 2025 (Charity Mission)
-- Uses sample vault/ images. Thumbnails in sample vault/thumbs/
INSERT INTO vault_items (album_id, year, title, caption, media_url, thumbnail_url, item_type, category, event_date, location, uploaded_by, is_featured, is_public)
SELECT 'villa-maria-2025', 2025, 'Annual Gift Giving 2025: Villa Maria Integrated School',
  caption, media_url, thumb_url, 'photo', 'mission', '2025-12-15', 'Villa Maria Integrated School', 1, is_feat, TRUE
FROM (VALUES
  ('Fraternity members arriving with gifts and supplies', 'sample vault/012ec369-ea52-42fc-912a-d1ef7504950a.jpg', 'sample vault/thumbs/012ec369-ea52-42fc-912a-d1ef7504950a.jpg', TRUE),
  ('Distributing school supplies to eager students', 'sample vault/10cd9e8d-2106-42c5-996a-ba7b590fe852.jpg', 'sample vault/thumbs/10cd9e8d-2106-42c5-996a-ba7b590fe852.jpg', FALSE),
  ('Group photo with Villa Maria students and faculty', 'sample vault/21f815ad-4772-4ed3-b327-9aa23fee294e.jpg', 'sample vault/thumbs/21f815ad-4772-4ed3-b327-9aa23fee294e.jpg', FALSE),
  ('Interactive activities and games with the children', 'sample vault/28da8bc3-b009-46b1-a938-ff815d169cc3.jpg', 'sample vault/thumbs/28da8bc3-b009-46b1-a938-ff815d169cc3.jpg', FALSE),
  ('Setting up the donation station', 'sample vault/2eaf4706-2fdd-47ba-ae98-a07b479269e6.jpg', 'sample vault/thumbs/2eaf4706-2fdd-47ba-ae98-a07b479269e6.jpg', FALSE),
  ('Students receiving new backpacks', 'sample vault/2f8a6a33-7bd4-4672-9cdf-3cd4449d616e.jpg', 'sample vault/thumbs/2f8a6a33-7bd4-4672-9cdf-3cd4449d616e.jpg', FALSE),
  ('Reading session with the younger students', 'sample vault/47db4c7e-009a-4261-a8e2-d7a2f6f4eb55.jpg', 'sample vault/thumbs/47db4c7e-009a-4261-a8e2-d7a2f6f4eb55.jpg', FALSE),
  ('Fraternity brothers with school principal', 'sample vault/5349e504-5814-469a-aac3-cd15565c51a8.jpg', 'sample vault/thumbs/5349e504-5814-469a-aac3-cd15565c51a8.jpg', FALSE),
  ('Organizing donated books for the library', 'sample vault/542a8380-fae7-4ae4-9372-3bd5c0c42c7f.jpg', 'sample vault/thumbs/542a8380-fae7-4ae4-9372-3bd5c0c42c7f.jpg', FALSE),
  ('Sports equipment distribution', 'sample vault/6525a973-34cf-40e0-b1e0-417e675d8d41.jpg', 'sample vault/thumbs/6525a973-34cf-40e0-b1e0-417e675d8d41.jpg', FALSE),
  ('Art supplies handover ceremony', 'sample vault/66ac2a3f-ed7a-44cc-9d5e-0db23b1b86d4.jpg', 'sample vault/thumbs/66ac2a3f-ed7a-44cc-9d5e-0db23b1b86d4.jpg', FALSE),
  ('Students showcasing their new materials', 'sample vault/75e230e1-8c53-4397-ba14-b2606780ce41.jpg', 'sample vault/thumbs/75e230e1-8c53-4397-ba14-b2606780ce41.jpg', FALSE),
  ('Brotherhood members teaching basic first aid', 'sample vault/8ecbf87d-4371-435d-8f92-4976f4500daf.jpg', 'sample vault/thumbs/8ecbf87d-4371-435d-8f92-4976f4500daf.jpg', FALSE),
  ('Lunch break with the students', 'sample vault/ac6376cd-926d-4cde-881b-8038f5c14a65.jpg', 'sample vault/thumbs/ac6376cd-926d-4cde-881b-8038f5c14a65.jpg', FALSE),
  ('Musical performance by ZBM members', 'sample vault/be8869ff-3988-42f8-a3b4-8eff81a42ba2.jpg', 'sample vault/thumbs/be8869ff-3988-42f8-a3b4-8eff81a42ba2.jpg', FALSE),
  ('Thank you ceremony from the students', 'sample vault/c50e3c67-1e97-4271-a61e-5ca8cb63eaac.jpg', 'sample vault/thumbs/c50e3c67-1e97-4271-a61e-5ca8cb63eaac.jpg', FALSE),
  ('Final group photo with all participants', 'sample vault/cc5273a3-24ce-414a-82dc-d54406d977bf.jpg', 'sample vault/thumbs/cc5273a3-24ce-414a-82dc-d54406d977bf.jpg', FALSE),
  ('Packing up after a successful event', 'sample vault/ceb34cb3-f492-4828-bfe2-628662bfad4f.jpg', 'sample vault/thumbs/ceb34cb3-f492-4828-bfe2-628662bfad4f.jpg', FALSE),
  ('Students waving goodbye', 'sample vault/e680bf91-375b-40e2-854f-096cb9170daf.jpg', 'sample vault/thumbs/e680bf91-375b-40e2-854f-096cb9170daf.jpg', FALSE),
  ('Commemorative plaque presentation', 'sample vault/e74af5dd-cea2-40c6-a1f4-c7c00ad8d01f.jpg', 'sample vault/thumbs/e74af5dd-cea2-40c6-a1f4-c7c00ad8d01f.jpg', FALSE)
) AS t(caption, media_url, thumb_url, is_feat);

-- VAULT ITEMS — Other albums (using image/placeholders/photos/)
INSERT INTO vault_items (album_id, year, title, caption, media_url, thumbnail_url, item_type, category, event_date, location, uploaded_by, is_featured, is_public)
SELECT album_id, yr, title, caption, media_url, thumb_url, 'photo', cat::vault_category, evt_date::date, loc, 1, is_feat, TRUE
FROM (VALUES
  -- Annual Gala 2024
  ('annual-gala-2024', 2024, 'Annual Fraternity Gala 2024', 'Grand ballroom setup with elegant decorations', 'image/placeholders/photos/u-1511795409834-ef04bbd61622.jpg', 'image/placeholders/photos/thumbs/u-1511795409834-ef04bbd61622.jpg', 'gala', '2024-11-20', 'The Grand Hotel Ballroom', TRUE),
  ('annual-gala-2024', 2024, 'Annual Fraternity Gala 2024', 'Guests arriving at the red carpet entrance', 'image/placeholders/photos/u-1519167758481-83f29da8c2b0.jpg', 'image/placeholders/photos/thumbs/u-1519167758481-83f29da8c2b0.jpg', 'gala', '2024-11-20', 'The Grand Hotel Ballroom', FALSE),
  ('annual-gala-2024', 2024, 'Annual Fraternity Gala 2024', 'Opening remarks by the fraternity president', 'image/placeholders/photos/u-1464366400600-7168b8af9bc3.jpg', 'image/placeholders/photos/thumbs/u-1464366400600-7168b8af9bc3.jpg', 'gala', '2024-11-20', 'The Grand Hotel Ballroom', FALSE),
  ('annual-gala-2024', 2024, 'Annual Fraternity Gala 2024', 'Award presentation to distinguished alumni', 'image/placeholders/photos/u-1478145046317-39f10e56b5e9.jpg', 'image/placeholders/photos/thumbs/u-1478145046317-39f10e56b5e9.jpg', 'gala', '2024-11-20', 'The Grand Hotel Ballroom', FALSE),
  ('annual-gala-2024', 2024, 'Annual Fraternity Gala 2024', 'Keynote speaker addressing the audience', 'image/placeholders/photos/u-1530103862676-de8c9debad1d.jpg', 'image/placeholders/photos/thumbs/u-1530103862676-de8c9debad1d.jpg', 'gala', '2024-11-20', 'The Grand Hotel Ballroom', FALSE),
  ('annual-gala-2024', 2024, 'Annual Fraternity Gala 2024', 'Formal dinner service', 'image/placeholders/photos/u-1505236858219-8359eb29e329.jpg', 'image/placeholders/photos/thumbs/u-1505236858219-8359eb29e329.jpg', 'gala', '2024-11-20', 'The Grand Hotel Ballroom', FALSE),
  ('annual-gala-2024', 2024, 'Annual Fraternity Gala 2024', 'Live orchestra performance', 'image/placeholders/photos/u-1519225421980-715cb0215aed.jpg', 'image/placeholders/photos/thumbs/u-1519225421980-715cb0215aed.jpg', 'gala', '2024-11-20', 'The Grand Hotel Ballroom', FALSE),
  ('annual-gala-2024', 2024, 'Annual Fraternity Gala 2024', 'Dancing and celebration', 'image/placeholders/photos/u-1492684223066-81342ee5ff30.jpg', 'image/placeholders/photos/thumbs/u-1492684223066-81342ee5ff30.jpg', 'gala', '2024-11-20', 'The Grand Hotel Ballroom', FALSE),
  -- Medical Mission 2024
  ('medical-mission-2024', 2024, 'Rural Medical Mission 2024', 'Medical team setting up the clinic', 'image/placeholders/photos/u-1576091160399-112ba8d25d1d.jpg', 'image/placeholders/photos/thumbs/u-1576091160399-112ba8d25d1d.jpg', 'mission', '2024-08-10', 'Barangay San Isidro, Batangas', FALSE),
  ('medical-mission-2024', 2024, 'Rural Medical Mission 2024', 'Free consultation and check-ups', 'image/placeholders/photos/u-1584982751601-97dcc096659c.jpg', 'image/placeholders/photos/thumbs/u-1584982751601-97dcc096659c.jpg', 'mission', '2024-08-10', 'Barangay San Isidro, Batangas', FALSE),
  ('medical-mission-2024', 2024, 'Rural Medical Mission 2024', 'Distributing free medicines', 'image/placeholders/photos/u-1631815588090-d4bfec5b1ccb.jpg', 'image/placeholders/photos/thumbs/u-1631815588090-d4bfec5b1ccb.jpg', 'mission', '2024-08-10', 'Barangay San Isidro, Batangas', FALSE),
  ('medical-mission-2024', 2024, 'Rural Medical Mission 2024', 'Dental services for children', 'image/placeholders/photos/u-1579684385127-1ef15d508118.jpg', 'image/placeholders/photos/thumbs/u-1579684385127-1ef15d508118.jpg', 'mission', '2024-08-10', 'Barangay San Isidro, Batangas', FALSE),
  ('medical-mission-2024', 2024, 'Rural Medical Mission 2024', 'Health education seminar', 'image/placeholders/photos/u-1582750433449-648ed127bb54.jpg', 'image/placeholders/photos/thumbs/u-1582750433449-648ed127bb54.jpg', 'mission', '2024-08-10', 'Barangay San Isidro, Batangas', FALSE),
  ('medical-mission-2024', 2024, 'Rural Medical Mission 2024', 'Team photo with community members', 'image/placeholders/photos/u-1516549655169-df83a0774514.jpg', 'image/placeholders/photos/thumbs/u-1516549655169-df83a0774514.jpg', 'mission', '2024-08-10', 'Barangay San Isidro, Batangas', FALSE),
  -- Induction Ceremony 2024
  ('induction-ceremony-2024', 2024, 'New Member Induction Ceremony 2024', 'Inductees taking the fraternity oath', 'image/placeholders/photos/u-1523050854058-8df90110c9f1.jpg', 'image/placeholders/photos/thumbs/u-1523050854058-8df90110c9f1.jpg', 'induction', '2024-03-15', 'University Great Hall', FALSE),
  ('induction-ceremony-2024', 2024, 'New Member Induction Ceremony 2024', 'Ceremonial candle lighting', 'image/placeholders/photos/u-1517486808906-6ca8b3f04846.jpg', 'image/placeholders/photos/thumbs/u-1517486808906-6ca8b3f04846.jpg', 'induction', '2024-03-15', 'University Great Hall', FALSE),
  ('induction-ceremony-2024', 2024, 'New Member Induction Ceremony 2024', 'Presentation of fraternity pins', 'image/placeholders/photos/u-1541339907198-e08756dedf3f.jpg', 'image/placeholders/photos/thumbs/u-1541339907198-e08756dedf3f.jpg', 'induction', '2024-03-15', 'University Great Hall', FALSE),
  ('induction-ceremony-2024', 2024, 'New Member Induction Ceremony 2024', 'Senior members welcoming new brothers', 'image/placeholders/photos/u-1524178232363-1fb2b075b655.jpg', 'image/placeholders/photos/thumbs/u-1524178232363-1fb2b075b655.jpg', 'induction', '2024-03-15', 'University Great Hall', FALSE),
  ('induction-ceremony-2024', 2024, 'New Member Induction Ceremony 2024', 'Group photo of the new batch', 'image/placeholders/photos/u-1529070538774-1843cb3265df.jpg', 'image/placeholders/photos/thumbs/u-1529070538774-1843cb3265df.jpg', 'induction', '2024-03-15', 'University Great Hall', FALSE),
  -- Founders Day 2023
  ('founders-day-2023', 2023, 'Founders Day Commemoration 2023', 'Wreath laying ceremony at founders monument', 'image/placeholders/photos/u-1511578314322-379afb476865.jpg', 'image/placeholders/photos/thumbs/u-1511578314322-379afb476865.jpg', 'founders_day', '2023-10-08', 'Fraternity Memorial Garden', FALSE),
  ('founders-day-2023', 2023, 'Founders Day Commemoration 2023', 'Historical photo exhibition', 'image/placeholders/photos/u-1475721027785-f74eccf877e2.jpg', 'image/placeholders/photos/thumbs/u-1475721027785-f74eccf877e2.jpg', 'founders_day', '2023-10-08', 'Fraternity Memorial Garden', FALSE),
  ('founders-day-2023', 2023, 'Founders Day Commemoration 2023', 'Founding members sharing stories', 'image/placeholders/photos/u-1556761175-4b46a572b786.jpg', 'image/placeholders/photos/thumbs/u-1556761175-4b46a572b786.jpg', 'founders_day', '2023-10-08', 'Fraternity Memorial Garden', FALSE),
  ('founders-day-2023', 2023, 'Founders Day Commemoration 2023', 'Memorial service and prayer', 'image/placeholders/photos/u-1515187029135-18ee286d815b.jpg', 'image/placeholders/photos/thumbs/u-1515187029135-18ee286d815b.jpg', 'founders_day', '2023-10-08', 'Fraternity Memorial Garden', FALSE),
  ('founders-day-2023', 2023, 'Founders Day Commemoration 2023', 'All generations of members together', 'image/placeholders/photos/u-1522071820081-009f0129c71c.jpg', 'image/placeholders/photos/thumbs/u-1522071820081-009f0129c71c.jpg', 'founders_day', '2023-10-08', 'Fraternity Memorial Garden', FALSE),
  -- Research Symposium 2023
  ('research-symposium-2023', 2023, 'Medical Research Symposium 2023', 'Research presentation on stage', 'image/placeholders/photos/u-1576091160550-2173dba999ef.jpg', 'image/placeholders/photos/thumbs/u-1576091160550-2173dba999ef.jpg', 'research', '2023-06-22', 'Medical School Auditorium', FALSE),
  ('research-symposium-2023', 2023, 'Medical Research Symposium 2023', 'Poster session and networking', 'image/placeholders/photos/u-1532094349884-543bc11b234d.jpg', 'image/placeholders/photos/thumbs/u-1532094349884-543bc11b234d.jpg', 'research', '2023-06-22', 'Medical School Auditorium', FALSE),
  ('research-symposium-2023', 2023, 'Medical Research Symposium 2023', 'Panel discussion with experts', 'image/placeholders/photos/u-1581093458791-9d42e1e4b8f3.jpg', 'image/placeholders/photos/thumbs/u-1581093458791-9d42e1e4b8f3.jpg', 'research', '2023-06-22', 'Medical School Auditorium', FALSE),
  ('research-symposium-2023', 2023, 'Medical Research Symposium 2023', 'Laboratory demonstrations', 'image/placeholders/photos/u-1582560475093-ba66accbc424.jpg', 'image/placeholders/photos/thumbs/u-1582560475093-ba66accbc424.jpg', 'research', '2023-06-22', 'Medical School Auditorium', FALSE),
  ('research-symposium-2023', 2023, 'Medical Research Symposium 2023', 'Award ceremony for best research', 'image/placeholders/photos/u-1581594549595-35f6edc7b762.jpg', 'image/placeholders/photos/thumbs/u-1581594549595-35f6edc7b762.jpg', 'research', '2023-06-22', 'Medical School Auditorium', FALSE)
) AS t(album_id, yr, title, caption, media_url, thumb_url, cat, evt_date, loc, is_feat);

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
