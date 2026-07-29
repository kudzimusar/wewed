-- Phase 1: multi-wedding membership access and active-wedding selection.
-- The statements are idempotent because the live Supabase schema may be
-- upgraded before Prisma records this migration during the next deployment.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "currentWeddingId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_currentWeddingId_fkey'
      AND conrelid = '"User"'::regclass
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_currentWeddingId_fkey"
      FOREIGN KEY ("currentWeddingId") REFERENCES "Wedding"(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WeddingMembership" (
  id TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'planner',
  status TEXT NOT NULL DEFAULT 'invited',
  permissions TEXT,
  "invitedById" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WeddingMembership_pkey" PRIMARY KEY (id),
  CONSTRAINT "WeddingMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "WeddingMembership_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "WeddingMembership_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "WeddingMembership_userId_weddingId_key"
    UNIQUE ("userId", "weddingId")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WeddingMembership_user_wedding_key'
      AND conrelid = '"WeddingMembership"'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WeddingMembership_userId_weddingId_key'
      AND conrelid = '"WeddingMembership"'::regclass
  ) THEN
    ALTER TABLE "WeddingMembership"
      RENAME CONSTRAINT "WeddingMembership_user_wedding_key"
      TO "WeddingMembership_userId_weddingId_key";
  END IF;
END $$;

ALTER TABLE "WeddingMembership"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE INDEX IF NOT EXISTS "WeddingMembership_weddingId_status_idx"
  ON "WeddingMembership"("weddingId", status);
CREATE INDEX IF NOT EXISTS "WeddingMembership_userId_status_idx"
  ON "WeddingMembership"("userId", status);
CREATE INDEX IF NOT EXISTS "User_currentWeddingId_idx"
  ON "User"("currentWeddingId");

INSERT INTO "WeddingMembership" (
  id, "userId", "weddingId", role, status, permissions,
  "acceptedAt", "createdAt", "updatedAt"
)
SELECT
  'wm_' || md5(u.id || ':' || w.id),
  u.id,
  w.id,
  CASE WHEN u.role = 'couple' THEN 'owner' ELSE 'planner' END,
  'active',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "Wedding" w ON w."coupleId" = u."coupleId"
WHERE u."coupleId" IS NOT NULL
  AND u.role IN ('couple', 'planner')
ON CONFLICT ("userId", "weddingId") DO NOTHING;

UPDATE "User" u
SET "currentWeddingId" = (
      SELECT w.id
      FROM "Wedding" w
      LEFT JOIN "WeddingMembership" membership
        ON membership."weddingId" = w.id
       AND membership."userId" = u.id
       AND membership.status = 'active'
      WHERE u.role = 'admin' OR membership.id IS NOT NULL
      ORDER BY w.date ASC, w."createdAt" ASC
      LIMIT 1
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE u."currentWeddingId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "Wedding" w
    LEFT JOIN "WeddingMembership" membership
      ON membership."weddingId" = w.id
     AND membership."userId" = u.id
     AND membership.status = 'active'
    WHERE u.role = 'admin' OR membership.id IS NOT NULL
  );
