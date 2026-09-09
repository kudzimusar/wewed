-- Freeze the bulk-printed invitation credential used by Charity & Kudzie's
-- physical A4 invitation so the printed fallback code and QR always resolve
-- to the same wedding-level read-only access record.

WITH target_wedding AS (
  SELECT "id"
  FROM "Wedding"
  WHERE "slug" = 'charity-and-kudzie'
  LIMIT 1
)
UPDATE "QRDestination"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "weddingId" IN (SELECT "id" FROM target_wedding)
  AND "type" = 'physical_invitation'
  AND "id" <> 'print_CHRTYKDZ23';

INSERT INTO "QRDestination" (
  "id",
  "label",
  "url",
  "type",
  "scanCount",
  "isActive",
  "weddingId",
  "createdAt",
  "updatedAt"
)
SELECT
  'print_CHRTYKDZ23',
  'Bulk printed wedding invitation',
  '/w/charity-and-kudzie',
  'physical_invitation',
  0,
  true,
  "id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Wedding"
WHERE "slug" = 'charity-and-kudzie'
ON CONFLICT ("id") DO UPDATE SET
  "label" = EXCLUDED."label",
  "url" = EXCLUDED."url",
  "type" = EXCLUDED."type",
  "isActive" = true,
  "weddingId" = EXCLUDED."weddingId",
  "updatedAt" = CURRENT_TIMESTAMP;
