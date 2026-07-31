-- Wewed parent-company business administration layer.
-- Additive only: existing planner, couple, wedding, vendor, and authentication tables are unchanged.

CREATE TABLE IF NOT EXISTS public."BusinessAccount" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'client',
  "status" TEXT NOT NULL DEFAULT 'active',
  "ownerUserId" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "onboardingStatus" TEXT NOT NULL DEFAULT 'not_started',
  "subscriptionPlan" TEXT NOT NULL DEFAULT 'free',
  "subscriptionStatus" TEXT NOT NULL DEFAULT 'inactive',
  "trialEndsAt" TIMESTAMP(3),
  "currentPeriodEndsAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessAccount_slug_key" UNIQUE ("slug"),
  CONSTRAINT "BusinessAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BusinessAccount_type_status_idx" ON public."BusinessAccount"("type", "status");
CREATE INDEX IF NOT EXISTS "BusinessAccount_subscriptionStatus_idx" ON public."BusinessAccount"("subscriptionStatus");
CREATE INDEX IF NOT EXISTS "BusinessAccount_source_idx" ON public."BusinessAccount"("sourceType", "sourceId");

CREATE TABLE IF NOT EXISTS public."BusinessAccountMember" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'active',
  "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessAccountMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessAccountMember_account_user_key" UNIQUE ("businessAccountId", "userId"),
  CONSTRAINT "BusinessAccountMember_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES public."BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessAccountMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BusinessAccountMember_user_status_idx" ON public."BusinessAccountMember"("userId", "status");
CREATE INDEX IF NOT EXISTS "BusinessAccountMember_account_status_idx" ON public."BusinessAccountMember"("businessAccountId", "status");

CREATE TABLE IF NOT EXISTS public."BusinessAccountLink" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "relationship" TEXT NOT NULL DEFAULT 'owns',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessAccountLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessAccountLink_account_entity_key" UNIQUE ("businessAccountId", "entityType", "entityId"),
  CONSTRAINT "BusinessAccountLink_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES public."BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BusinessAccountLink_entity_idx" ON public."BusinessAccountLink"("entityType", "entityId");

CREATE TABLE IF NOT EXISTS public."PaymentRecord" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'manual',
  "providerReference" TEXT,
  "type" TEXT NOT NULL DEFAULT 'subscription',
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentRecord_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES public."BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PaymentRecord_account_status_idx" ON public."PaymentRecord"("businessAccountId", "status");
CREATE INDEX IF NOT EXISTS "PaymentRecord_createdAt_idx" ON public."PaymentRecord"("createdAt");

CREATE TABLE IF NOT EXISTS public."SupportCase" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'general',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'open',
  "requesterEmail" TEXT,
  "assignedToUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupportCase_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES public."BusinessAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SupportCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SupportCase_status_priority_idx" ON public."SupportCase"("status", "priority");
CREATE INDEX IF NOT EXISTS "SupportCase_account_idx" ON public."SupportCase"("businessAccountId");

CREATE TABLE IF NOT EXISTS public."PlatformIncident" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "status" TEXT NOT NULL DEFAULT 'investigating',
  "severity" TEXT NOT NULL DEFAULT 'minor',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformIncident_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformIncident_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PlatformIncident_status_severity_idx" ON public."PlatformIncident"("status", "severity");

CREATE TABLE IF NOT EXISTS public."BusinessAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "businessAccountId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BusinessAuditLog_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES public."BusinessAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BusinessAuditLog_createdAt_idx" ON public."BusinessAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "BusinessAuditLog_account_idx" ON public."BusinessAuditLog"("businessAccountId", "createdAt");

-- Wewed internal parent account.
INSERT INTO public."BusinessAccount" (
  "id", "name", "slug", "type", "status", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "metadata"
)
VALUES (
  'wewed-platform', 'Wewed', 'wewed-platform', 'wewed_internal', 'active', 'complete', 'internal', 'active', '{"system":true}'::jsonb
)
ON CONFLICT ("slug") DO NOTHING;

-- Existing couples become client business accounts without changing Couple records.
INSERT INTO public."BusinessAccount" (
  "id", "name", "slug", "type", "status", "sourceType", "sourceId", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "metadata"
)
SELECT
  'couple-' || c.id,
  c."partner1" || ' & ' || c."partner2",
  'couple-' || c.slug,
  'couple',
  'active',
  'couple',
  c.id,
  'complete',
  COALESCE(NULLIF(c."subscriptionStatus", ''), 'free'),
  CASE WHEN COALESCE(NULLIF(c."subscriptionStatus", ''), 'free') = 'free' THEN 'free' ELSE 'active' END,
  jsonb_build_object('legacyCoupleId', c.id)
FROM public."Couple" c
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO public."BusinessAccountLink" ("id", "businessAccountId", "entityType", "entityId", "relationship")
SELECT 'link-couple-' || c.id, 'couple-' || c.id, 'couple', c.id, 'owns'
FROM public."Couple" c
ON CONFLICT ("businessAccountId", "entityType", "entityId") DO NOTHING;

INSERT INTO public."BusinessAccountLink" ("id", "businessAccountId", "entityType", "entityId", "relationship")
SELECT 'link-wedding-' || w.id, 'couple-' || w."coupleId", 'wedding', w.id, 'owns'
FROM public."Wedding" w
ON CONFLICT ("businessAccountId", "entityType", "entityId") DO NOTHING;

-- Existing planner users become planning-business accounts and retain all wedding memberships.
INSERT INTO public."BusinessAccount" (
  "id", "name", "slug", "type", "status", "ownerUserId", "sourceType", "sourceId", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "metadata"
)
SELECT
  'planner-' || u.id,
  COALESCE(NULLIF(u.name, ''), u.email),
  'planner-' || md5(lower(u.email)),
  'planning_company',
  CASE WHEN u."isActive" THEN 'active' ELSE 'suspended' END,
  u.id,
  'user',
  u.id,
  'complete',
  'free',
  'free',
  jsonb_build_object('legacyUserId', u.id, 'email', u.email)
FROM public."User" u
WHERE u.role = 'planner'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO public."BusinessAccountMember" ("id", "businessAccountId", "userId", "role", "status", "permissions")
SELECT 'member-planner-' || u.id, 'planner-' || u.id, u.id, 'business_owner', CASE WHEN u."isActive" THEN 'active' ELSE 'suspended' END, '["account.manage","weddings.manage"]'::jsonb
FROM public."User" u
WHERE u.role = 'planner'
ON CONFLICT ("businessAccountId", "userId") DO NOTHING;

INSERT INTO public."BusinessAccountLink" ("id", "businessAccountId", "entityType", "entityId", "relationship")
SELECT 'planner-wedding-' || wm.id, 'planner-' || wm."userId", 'wedding', wm."weddingId", 'manages'
FROM public."WeddingMembership" wm
JOIN public."User" u ON u.id = wm."userId"
WHERE u.role = 'planner' AND wm.status = 'active'
ON CONFLICT ("businessAccountId", "entityType", "entityId") DO NOTHING;

-- Venue businesses are derived from existing wedding venues, including Imba Manor.
INSERT INTO public."BusinessAccount" (
  "id", "name", "slug", "type", "status", "sourceType", "sourceId", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "metadata"
)
SELECT DISTINCT
  'venue-' || md5(lower(trim(w.venue))),
  trim(w.venue),
  'venue-' || md5(lower(trim(w.venue))),
  'venue',
  'active',
  'venue_name',
  lower(trim(w.venue)),
  'complete',
  'free',
  'free',
  jsonb_build_object('city', w."venueCity", 'country', w."venueCountry")
FROM public."Wedding" w
WHERE trim(COALESCE(w.venue, '')) <> ''
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO public."BusinessAccountLink" ("id", "businessAccountId", "entityType", "entityId", "relationship")
SELECT
  'venue-wedding-' || w.id,
  'venue-' || md5(lower(trim(w.venue))),
  'wedding',
  w.id,
  'hosts'
FROM public."Wedding" w
WHERE trim(COALESCE(w.venue, '')) <> ''
ON CONFLICT ("businessAccountId", "entityType", "entityId") DO NOTHING;

-- Existing wedding-scoped Vendor rows become vendor businesses.
INSERT INTO public."BusinessAccount" (
  "id", "name", "slug", "type", "status", "sourceType", "sourceId", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "metadata"
)
SELECT
  'vendor-' || v.id,
  v.name,
  'vendor-' || v.id,
  'vendor',
  'active',
  'vendor',
  v.id,
  'complete',
  'free',
  'free',
  jsonb_build_object('category', v.category)
FROM public."Vendor" v
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO public."BusinessAccountLink" ("id", "businessAccountId", "entityType", "entityId", "relationship")
SELECT 'vendor-link-' || v.id, 'vendor-' || v.id, 'vendor', v.id, 'represents'
FROM public."Vendor" v
ON CONFLICT ("businessAccountId", "entityType", "entityId") DO NOTHING;

INSERT INTO public."BusinessAccountLink" ("id", "businessAccountId", "entityType", "entityId", "relationship")
SELECT 'vendor-wedding-' || v.id, 'vendor-' || v.id, 'wedding', v."weddingId", 'serves'
FROM public."Vendor" v
ON CONFLICT ("businessAccountId", "entityType", "entityId") DO NOTHING;
