-- WEWED MOBILE SHADOW — PHASE 1 DOMAIN COUNT AUDIT
-- Replace __WEDDING_ID__ locally with the authoritative wedding ID returned by
-- 01_discover_reference_wedding_readonly.sql.
--
-- This query returns counts/status aggregates only. It does not return guest PII,
-- message bodies, contract payloads, tokens or payment references.

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';

WITH target AS (
  SELECT '__WEDDING_ID__'::text AS wedding_id
)
SELECT 'planner_tasks' AS domain, count(*)::bigint AS row_count
FROM "PlannerTask", target WHERE "weddingId" = target.wedding_id
UNION ALL
SELECT 'budget_items', count(*) FROM "BudgetItem", target WHERE "weddingId" = target.wedding_id
UNION ALL
SELECT 'vendors', count(*) FROM "Vendor", target WHERE "weddingId" = target.wedding_id
UNION ALL
SELECT 'service_engagements', count(*) FROM "ServiceEngagement", target WHERE "weddingId" = target.wedding_id
UNION ALL
SELECT 'guests', count(*) FROM "Guest", target WHERE "weddingId" = target.wedding_id
UNION ALL
SELECT 'seating_tables', count(*) FROM "SeatingTable", target WHERE "weddingId" = target.wedding_id
UNION ALL
SELECT 'programme_items', count(*) FROM "ProgrammeItem", target WHERE "weddingId" = target.wedding_id
UNION ALL
SELECT 'memberships', count(*) FROM "WeddingMembership", target WHERE "weddingId" = target.wedding_id
UNION ALL
SELECT 'vault_objects', count(*) FROM "VaultObject", target WHERE "weddingId" = target.wedding_id
UNION ALL
SELECT 'notifications', count(*) FROM "Notification", target WHERE "weddingId" = target.wedding_id
ORDER BY domain;

-- Task distribution, without task text.
WITH target AS (SELECT '__WEDDING_ID__'::text AS wedding_id)
SELECT status, priority, count(*) AS count
FROM "PlannerTask", target
WHERE "weddingId" = target.wedding_id
GROUP BY status, priority
ORDER BY status, priority;

-- RSVP distribution, without guest identity or token.
WITH target AS (SELECT '__WEDDING_ID__'::text AS wedding_id)
SELECT
  CASE
    WHEN r.attending IS TRUE THEN 'attending'
    WHEN r.attending IS FALSE THEN 'declined'
    ELSE 'pending'
  END AS rsvp_state,
  count(*) AS count,
  count(*) FILTER (WHERE r."checkedIn" IS TRUE) AS checked_in
FROM "Guest" g
JOIN target ON target.wedding_id = g."weddingId"
LEFT JOIN "RSVP" r ON r."guestId" = g.id
GROUP BY rsvp_state
ORDER BY rsvp_state;

-- Seating occupancy by table, no guest names.
WITH target AS (SELECT '__WEDDING_ID__'::text AS wedding_id)
SELECT
  st.id AS table_id,
  st.name AS table_name,
  st.capacity,
  count(g.id) AS assigned_guest_records
FROM "SeatingTable" st
JOIN target ON target.wedding_id = st."weddingId"
LEFT JOIN "Guest" g ON g."seatingTableId" = st.id
GROUP BY st.id, st.name, st.capacity
ORDER BY st.name;

-- Budget position. No payment references or contract content.
WITH target AS (SELECT '__WEDDING_ID__'::text AS wedding_id)
SELECT
  count(*) AS item_count,
  coalesce(sum("estimatedCost"), 0) AS estimated_total,
  coalesce(sum("actualCost"), 0) AS actual_total,
  coalesce(sum("paidAmount"), 0) AS paid_total
FROM "BudgetItem", target
WHERE "weddingId" = target.wedding_id;

-- Planner memberships. Deliberately excludes user email/password.
WITH target AS (SELECT '__WEDDING_ID__'::text AS wedding_id)
SELECT
  wm.id AS membership_id,
  wm."userId",
  wm.role,
  wm.status,
  wm."acceptedAt",
  wm."revokedAt",
  u.name AS display_name,
  u.role AS account_role
FROM "WeddingMembership" wm
JOIN target ON target.wedding_id = wm."weddingId"
JOIN "User" u ON u.id = wm."userId"
ORDER BY wm.role, u.name;

ROLLBACK;
