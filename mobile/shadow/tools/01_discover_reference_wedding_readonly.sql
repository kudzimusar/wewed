-- WEWED MOBILE SHADOW — PHASE 1 READ-ONLY DISCOVERY
-- Reference: Charity & Kudzie / Eleven Eleven Testing
--
-- SAFETY:
--   1. Run only with an authorized READ-ONLY production credential.
--   2. This transaction is explicitly READ ONLY.
--   3. Do not paste query results containing PII into Git/chat logs.
--   4. This script identifies records; it does not export private content.

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

-- 1. Candidate wedding and couple identity.
-- Returns operational identifiers and non-secret wedding metadata only.
SELECT
  w.id AS wedding_id,
  w.slug AS wedding_slug,
  w.title AS wedding_title,
  w.date AS wedding_date,
  w.lifecycle,
  w.venue,
  w."venueCity",
  w."venueCountry",
  c.id AS couple_id,
  c.partner1,
  c.partner2
FROM "Wedding" w
JOIN "Couple" c ON c.id = w."coupleId"
WHERE
  (
    lower(c.partner1) LIKE '%charity%'
    AND lower(c.partner2) LIKE '%kudzie%'
  )
  OR
  (
    lower(c.partner1) LIKE '%kudzie%'
    AND lower(c.partner2) LIKE '%charity%'
  )
  OR lower(w.title) LIKE '%charity%kudzie%'
  OR lower(w.title) LIKE '%kudzie%charity%'
ORDER BY w."updatedAt" DESC;

-- 2. Planner/user candidates for Eleven Eleven Testing.
-- Deliberately excludes email, passwordHash, tokens and sessions.
SELECT
  u.id AS user_id,
  u.name AS user_name,
  u.role AS user_role,
  u."currentWeddingId",
  u."isActive"
FROM "User" u
WHERE lower(coalesce(u.name, '')) LIKE '%eleven eleven%'
ORDER BY u."updatedAt" DESC;

SELECT
  up.id AS profile_id,
  up."displayName",
  up.role,
  up."isBanned"
FROM "UserProfile" up
WHERE lower(coalesce(up."displayName", '')) LIKE '%eleven eleven%'
ORDER BY up."updatedAt" DESC;

ROLLBACK;
