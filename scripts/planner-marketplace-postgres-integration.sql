\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public."Couple" (id, slug, "partner1", "partner2", "subscriptionStatus", "createdAt", "updatedAt")
VALUES ('market-test-couple', 'market-test-couple', 'Taylor', 'Jordan', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "createdAt", "updatedAt")
VALUES ('market-test-wedding', 'market-test-wedding', 'Taylor & Jordan', '2027-08-12', 'Test Estate', 'Harare', 'Zimbabwe', 'market-test-couple', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO public."User" (id, email, name, role, "coupleId", "currentWeddingId", "isActive", "createdAt", "updatedAt") VALUES
  ('market-test-couple-user', 'couple.market@example.test', 'Taylor Couple', 'couple', 'market-test-couple', 'market-test-wedding', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('market-test-planner-user', 'planner.market@example.test', 'Morgan Planner', 'planner', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO public."WeddingMembership" (id, "userId", "weddingId", role, status, "acceptedAt", "createdAt", "updatedAt")
VALUES ('market-test-owner-membership', 'market-test-couple-user', 'market-test-wedding', 'owner', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO wewed_admin."BusinessAccount" (id, name, slug, type, status, "ownerUserId", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", metadata, "createdAt", "updatedAt") VALUES
  ('market-test-couple-account', 'Taylor & Jordan', 'market-test-couple-account', 'couple', 'active', 'market-test-couple-user', 'complete', 'starter', 'active', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('market-test-planner-account', 'Morgan Planning', 'market-test-planner-account', 'planning_company', 'active', 'market-test-planner-user', 'complete', 'professional', 'active', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO wewed_admin."BusinessAccountMember" (id, "businessAccountId", "userId", role, status, permissions, "createdAt", "updatedAt") VALUES
  ('market-test-couple-member', 'market-test-couple-account', 'market-test-couple-user', 'couple_owner', 'active', '["account.manage"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('market-test-planner-member', 'market-test-planner-account', 'market-test-planner-user', 'business_owner', 'active', '["weddings.manage"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO wewed_admin."BusinessAccountLink" (id, "businessAccountId", "entityType", "entityId", relationship, "createdAt")
VALUES ('market-test-couple-wedding-link', 'market-test-couple-account', 'wedding', 'market-test-wedding', 'owns', CURRENT_TIMESTAMP);

INSERT INTO wewed_admin."PlannerProfile" (id, "businessAccountId", slug, "displayName", services, "serviceAreas", status, "publishedAt", "createdAt", "updatedAt")
VALUES ('market-test-profile', 'market-test-planner-account', 'morgan-planning', 'Morgan Planning', '["Full planning"]'::jsonb, '["Harare"]'::jsonb, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO wewed_admin."PlannerEnquiry" (id, "weddingId", "coupleBusinessAccountId", "plannerBusinessAccountId", "plannerProfileId", "createdByUserId", status, "weddingDate", location, services, "sharedSummary", "createdAt", "updatedAt")
VALUES ('market-test-enquiry', 'market-test-wedding', 'market-test-couple-account', 'market-test-planner-account', 'market-test-profile', 'market-test-couple-user', 'accepted_interest', '2027-08-12', 'Harare', '["Full planning"]'::jsonb, '{"weddingTitle":"Taylor & Jordan"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public."WeddingMembership" WHERE "userId"='market-test-planner-user' AND "weddingId"='market-test-wedding') THEN
    RAISE EXCEPTION 'An enquiry must not create planner authority';
  END IF;
END $$;

INSERT INTO wewed_admin."PlannerEngagement" (id, "enquiryId", "weddingId", "coupleBusinessAccountId", "plannerBusinessAccountId", "plannerUserId", status, "requestedByUserId", "acceptedByUserId", "acceptedAt", "createdAt", "updatedAt")
VALUES ('market-test-engagement', 'market-test-enquiry', 'market-test-wedding', 'market-test-couple-account', 'market-test-planner-account', 'market-test-planner-user', 'planner_accepted', 'market-test-couple-user', 'market-test-planner-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO public."WeddingMembership" (id, "userId", "weddingId", role, status, permissions, "invitedById", "acceptedAt", "createdAt", "updatedAt")
VALUES ('market-test-planner-membership', 'market-test-planner-user', 'market-test-wedding', 'planner', 'active', '["planner.view","planner.edit"]', 'market-test-couple-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
UPDATE wewed_admin."PlannerEngagement" SET status='active', "authorityBundle"='planning', permissions='["planner.view","planner.edit"]'::jsonb, "membershipId"='market-test-planner-membership', "authorizedByUserId"='market-test-couple-user', "authorizedAt"=CURRENT_TIMESTAMP WHERE id='market-test-engagement';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."WeddingMembership" WHERE id='market-test-planner-membership' AND status='active') THEN RAISE EXCEPTION 'Authority activation failed'; END IF;
  IF EXISTS (SELECT 1 FROM wewed_admin."PaymentRecord") THEN RAISE EXCEPTION 'Marketplace test must not create payment records'; END IF;
END $$;

UPDATE public."WeddingMembership" SET status='revoked', "revokedAt"=CURRENT_TIMESTAMP WHERE id='market-test-planner-membership';
UPDATE wewed_admin."PlannerEngagement" SET status='revoked', "revokedAt"=CURRENT_TIMESTAMP, "endedByUserId"='market-test-couple-user' WHERE id='market-test-engagement';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public."WeddingMembership" WHERE id='market-test-planner-membership' AND status='active') THEN RAISE EXCEPTION 'Revocation failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM wewed_admin."PlannerEngagement" WHERE id='market-test-engagement' AND status='revoked') THEN RAISE EXCEPTION 'Engagement history was not retained'; END IF;
END $$;

ROLLBACK;
\echo '[wewed-marketplace-postgres] secure appointment and revocation contract passed'
