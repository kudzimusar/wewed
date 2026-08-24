-- Wewed Vendor Booking, Commerce, AI & Referral
-- Stamp: WW-BOOKING-COMMERCE-2026-08-24-01
-- Additive booking-commerce domain. Provider identity remains canonical in wewed_admin;
-- wedding-specific commercial commitments converge into public."ServiceEngagement".

CREATE SCHEMA IF NOT EXISTS wewed_booking;
REVOKE ALL ON SCHEMA wewed_booking FROM PUBLIC;

CREATE TABLE wewed_booking."ProviderCatalogItem" (
  "id" TEXT PRIMARY KEY,
  "offeringId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "bookingArchetype" TEXT NOT NULL,
  "bookingMode" TEXT NOT NULL DEFAULT 'request',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "basePriceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "pricingUnit" TEXT,
  "pricingSnapshotVersion" INTEGER NOT NULL DEFAULT 1,
  "minQuantity" INTEGER,
  "maxQuantity" INTEGER,
  "holdMinutes" INTEGER NOT NULL DEFAULT 15,
  "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
  "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
  "requiresFitting" BOOLEAN NOT NULL DEFAULT false,
  "requiresContract" BOOLEAN NOT NULL DEFAULT false,
  "attributes" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "addOns" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "availabilityPolicy" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderCatalogItem_offering_slug_key" UNIQUE ("offeringId", "slug"),
  CONSTRAINT "ProviderCatalogItem_booking_archetype_check" CHECK ("bookingArchetype" IN ('individual_rental','quantity_rental','appointment','timed_service','event_day_service','capacity','transport','package','custom','hybrid')),
  CONSTRAINT "ProviderCatalogItem_booking_mode_check" CHECK ("bookingMode" IN ('instant','request','quote','appointment','plan_only')),
  CONSTRAINT "ProviderCatalogItem_status_check" CHECK ("status" IN ('draft','published','archived')),
  CONSTRAINT "ProviderCatalogItem_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "ProviderCatalogItem_price_check" CHECK ("basePriceCents" IS NULL OR "basePriceCents" >= 0),
  CONSTRAINT "ProviderCatalogItem_quantity_check" CHECK (("minQuantity" IS NULL OR "minQuantity" >= 0) AND ("maxQuantity" IS NULL OR "maxQuantity" >= COALESCE("minQuantity", 0))),
  CONSTRAINT "ProviderCatalogItem_hold_check" CHECK ("holdMinutes" BETWEEN 1 AND 1440),
  CONSTRAINT "ProviderCatalogItem_buffer_check" CHECK ("bufferBeforeMinutes" >= 0 AND "bufferAfterMinutes" >= 0),
  CONSTRAINT "ProviderCatalogItem_offering_fkey" FOREIGN KEY ("offeringId") REFERENCES wewed_admin."ProviderServiceOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProviderCatalogItem_offering_status_sort_idx" ON wewed_booking."ProviderCatalogItem"("offeringId","status","sortOrder");

CREATE TABLE wewed_booking."ProviderCatalogVariant" (
  "id" TEXT PRIMARY KEY,
  "catalogItemId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "optionValues" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'active',
  "priceOverrideCents" INTEGER,
  "inventoryMode" TEXT NOT NULL DEFAULT 'none',
  "replacementValueCents" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderCatalogVariant_item_sku_key" UNIQUE ("catalogItemId","sku"),
  CONSTRAINT "ProviderCatalogVariant_id_item_key" UNIQUE ("id","catalogItemId"),
  CONSTRAINT "ProviderCatalogVariant_status_check" CHECK ("status" IN ('active','inactive','retired')),
  CONSTRAINT "ProviderCatalogVariant_inventory_mode_check" CHECK ("inventoryMode" IN ('none','serialized','pooled','capacity','time_slot')),
  CONSTRAINT "ProviderCatalogVariant_price_check" CHECK ("priceOverrideCents" IS NULL OR "priceOverrideCents" >= 0),
  CONSTRAINT "ProviderCatalogVariant_replacement_check" CHECK ("replacementValueCents" IS NULL OR "replacementValueCents" >= 0),
  CONSTRAINT "ProviderCatalogVariant_item_fkey" FOREIGN KEY ("catalogItemId") REFERENCES wewed_booking."ProviderCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProviderCatalogVariant_item_status_idx" ON wewed_booking."ProviderCatalogVariant"("catalogItemId","status");

CREATE TABLE wewed_booking."ProviderCatalogMedia" (
  "id" TEXT PRIMARY KEY,
  "catalogItemId" TEXT NOT NULL,
  "variantId" TEXT,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "altText" TEXT NOT NULL DEFAULT '',
  "caption" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderCatalogMedia_type_check" CHECK ("type" IN ('image','video')),
  CONSTRAINT "ProviderCatalogMedia_item_fkey" FOREIGN KEY ("catalogItemId") REFERENCES wewed_booking."ProviderCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProviderCatalogMedia_variant_item_fkey" FOREIGN KEY ("variantId","catalogItemId") REFERENCES wewed_booking."ProviderCatalogVariant"("id","catalogItemId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProviderCatalogMedia_item_published_sort_idx" ON wewed_booking."ProviderCatalogMedia"("catalogItemId","isPublished","sortOrder");

CREATE TABLE wewed_booking."BookingResource" (
  "id" TEXT PRIMARY KEY,
  "catalogItemId" TEXT NOT NULL,
  "variantId" TEXT,
  "name" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "serialReference" TEXT,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingResource_serial_key" UNIQUE ("serialReference"),
  CONSTRAINT "BookingResource_capacity_check" CHECK ("capacity" > 0),
  CONSTRAINT "BookingResource_status_check" CHECK ("status" IN ('active','maintenance','retired')),
  CONSTRAINT "BookingResource_type_check" CHECK ("resourceType" IN ('item','pool','staff','team','vehicle','venue','space','capacity','slot','other')),
  CONSTRAINT "BookingResource_item_fkey" FOREIGN KEY ("catalogItemId") REFERENCES wewed_booking."ProviderCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingResource_variant_item_fkey" FOREIGN KEY ("variantId","catalogItemId") REFERENCES wewed_booking."ProviderCatalogVariant"("id","catalogItemId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BookingResource_item_status_idx" ON wewed_booking."BookingResource"("catalogItemId","status");
CREATE INDEX "BookingResource_variant_status_idx" ON wewed_booking."BookingResource"("variantId","status");

CREATE TABLE wewed_booking."AvailabilityRule" (
  "id" TEXT PRIMARY KEY,
  "resourceId" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "dayOfWeek" INTEGER,
  "startsAt" TIMESTAMPTZ,
  "endsAt" TIMESTAMPTZ,
  "startTime" TIME,
  "endTime" TIME,
  "capacityOverride" INTEGER,
  "reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AvailabilityRule_type_check" CHECK ("ruleType" IN ('weekly','blackout','available_window','capacity_override')),
  CONSTRAINT "AvailabilityRule_day_check" CHECK ("dayOfWeek" IS NULL OR "dayOfWeek" BETWEEN 0 AND 6),
  CONSTRAINT "AvailabilityRule_capacity_check" CHECK ("capacityOverride" IS NULL OR "capacityOverride" >= 0),
  CONSTRAINT "AvailabilityRule_range_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt"),
  CONSTRAINT "AvailabilityRule_resource_fkey" FOREIGN KEY ("resourceId") REFERENCES wewed_booking."BookingResource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AvailabilityRule_resource_type_idx" ON wewed_booking."AvailabilityRule"("resourceId","ruleType");
CREATE INDEX "AvailabilityRule_window_idx" ON wewed_booking."AvailabilityRule"("startsAt","endsAt");

CREATE TABLE wewed_booking."ReferralLink" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "businessAccountId" TEXT NOT NULL,
  "catalogItemId" TEXT,
  "createdByUserId" TEXT,
  "channel" TEXT,
  "campaign" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ,
  CONSTRAINT "ReferralLink_business_fkey" FOREIGN KEY ("businessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReferralLink_item_fkey" FOREIGN KEY ("catalogItemId") REFERENCES wewed_booking."ProviderCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReferralLink_user_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ReferralLink_business_active_idx" ON wewed_booking."ReferralLink"("businessAccountId","isActive");

CREATE TABLE wewed_booking."Booking" (
  "id" TEXT PRIMARY KEY,
  "publicReference" TEXT NOT NULL UNIQUE,
  "businessAccountId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "customerUserId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "bookingMode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "subtotalCents" INTEGER,
  "feesCents" INTEGER NOT NULL DEFAULT 0,
  "depositCents" INTEGER,
  "totalCents" INTEGER,
  "priceSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "eventDate" DATE,
  "serviceStart" TIMESTAMPTZ,
  "serviceEnd" TIMESTAMPTZ,
  "pickupAt" TIMESTAMPTZ,
  "deliveryAt" TIMESTAMPTZ,
  "setupStart" TIMESTAMPTZ,
  "setupEnd" TIMESTAMPTZ,
  "collectionAt" TIMESTAMPTZ,
  "returnDueAt" TIMESTAMPTZ,
  "appointmentAt" TIMESTAMPTZ,
  "serviceLocation" TEXT,
  "guestCount" INTEGER,
  "customerNotes" TEXT,
  "vendorNotes" TEXT,
  "referralLinkId" TEXT,
  "serviceEngagementId" TEXT,
  "confirmedAt" TIMESTAMPTZ,
  "cancelledAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Booking_mode_check" CHECK ("bookingMode" IN ('instant','request','quote','appointment')),
  CONSTRAINT "Booking_status_check" CHECK ("status" IN ('draft','held','requested','quote_requested','awaiting_vendor','awaiting_terms','awaiting_deposit','confirmed','preparing','ready','in_progress','return_due','inspection','completed','declined','expired','cancelled','refunded','disputed')),
  CONSTRAINT "Booking_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Booking_money_check" CHECK (("subtotalCents" IS NULL OR "subtotalCents" >= 0) AND "feesCents" >= 0 AND ("depositCents" IS NULL OR "depositCents" >= 0) AND ("totalCents" IS NULL OR "totalCents" >= 0)),
  CONSTRAINT "Booking_guest_count_check" CHECK ("guestCount" IS NULL OR "guestCount" >= 0),
  CONSTRAINT "Booking_time_range_check" CHECK ("serviceStart" IS NULL OR "serviceEnd" IS NULL OR "serviceEnd" > "serviceStart"),
  CONSTRAINT "Booking_business_fkey" FOREIGN KEY ("businessAccountId") REFERENCES wewed_admin."BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Booking_offering_fkey" FOREIGN KEY ("offeringId") REFERENCES wewed_admin."ProviderServiceOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Booking_wedding_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Booking_customer_fkey" FOREIGN KEY ("customerUserId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Booking_creator_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Booking_referral_fkey" FOREIGN KEY ("referralLinkId") REFERENCES wewed_booking."ReferralLink"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Booking_engagement_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES public."ServiceEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Booking_wedding_created_idx" ON wewed_booking."Booking"("weddingId","createdAt" DESC);
CREATE INDEX "Booking_business_status_idx" ON wewed_booking."Booking"("businessAccountId","status","serviceStart");
CREATE INDEX "Booking_offering_status_idx" ON wewed_booking."Booking"("offeringId","status");
CREATE INDEX "Booking_customer_status_idx" ON wewed_booking."Booking"("customerUserId","status");

CREATE TABLE wewed_booking."BookingLine" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "catalogItemId" TEXT NOT NULL,
  "variantId" TEXT,
  "packageId" TEXT,
  "nameSnapshot" TEXT NOT NULL,
  "descriptionSnapshot" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPriceCents" INTEGER,
  "lineTotalCents" INTEGER,
  "pricingSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "selectedOptions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingLine_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "BookingLine_money_check" CHECK (("unitPriceCents" IS NULL OR "unitPriceCents" >= 0) AND ("lineTotalCents" IS NULL OR "lineTotalCents" >= 0)),
  CONSTRAINT "BookingLine_booking_fkey" FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingLine_item_fkey" FOREIGN KEY ("catalogItemId") REFERENCES wewed_booking."ProviderCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BookingLine_variant_item_fkey" FOREIGN KEY ("variantId","catalogItemId") REFERENCES wewed_booking."ProviderCatalogVariant"("id","catalogItemId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BookingLine_package_fkey" FOREIGN KEY ("packageId") REFERENCES wewed_admin."ProviderPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "BookingLine_booking_idx" ON wewed_booking."BookingLine"("bookingId");
CREATE INDEX "BookingLine_item_variant_idx" ON wewed_booking."BookingLine"("catalogItemId","variantId");

CREATE TABLE wewed_booking."BookingHold" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'active',
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMPTZ,
  CONSTRAINT "BookingHold_status_check" CHECK ("status" IN ('active','converted','released','expired')),
  CONSTRAINT "BookingHold_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "BookingHold_booking_fkey" FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingHold_user_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BookingHold_booking_status_idx" ON wewed_booking."BookingHold"("bookingId","status");
CREATE INDEX "BookingHold_expiry_idx" ON wewed_booking."BookingHold"("expiresAt") WHERE "status"='active';

CREATE TABLE wewed_booking."BookingResourceAllocation" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "bookingLineId" TEXT,
  "holdId" TEXT,
  "resourceId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "startsAt" TIMESTAMPTZ NOT NULL,
  "endsAt" TIMESTAMPTZ NOT NULL,
  "state" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingResourceAllocation_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "BookingResourceAllocation_range_check" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "BookingResourceAllocation_state_check" CHECK ("state" IN ('hold','confirmed','released','cancelled')),
  CONSTRAINT "BookingResourceAllocation_expiry_check" CHECK (("state" <> 'hold') OR "expiresAt" IS NOT NULL),
  CONSTRAINT "BookingResourceAllocation_booking_fkey" FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingResourceAllocation_line_fkey" FOREIGN KEY ("bookingLineId") REFERENCES wewed_booking."BookingLine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingResourceAllocation_hold_fkey" FOREIGN KEY ("holdId") REFERENCES wewed_booking."BookingHold"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingResourceAllocation_resource_fkey" FOREIGN KEY ("resourceId") REFERENCES wewed_booking."BookingResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BookingResourceAllocation_resource_window_idx" ON wewed_booking."BookingResourceAllocation"("resourceId","startsAt","endsAt","state");
CREATE INDEX "BookingResourceAllocation_booking_idx" ON wewed_booking."BookingResourceAllocation"("bookingId","state");

CREATE TABLE wewed_booking."BookingAmendment" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "requestedByUserId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "beforeSnapshot" JSONB NOT NULL,
  "afterSnapshot" JSONB NOT NULL,
  "priceDeltaCents" INTEGER,
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingAmendment_status_check" CHECK ("status" IN ('proposed','accepted','rejected','withdrawn')),
  CONSTRAINT "BookingAmendment_booking_fkey" FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingAmendment_requester_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BookingAmendment_decider_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "BookingAmendment_booking_status_idx" ON wewed_booking."BookingAmendment"("bookingId","status","createdAt" DESC);

CREATE TABLE wewed_booking."BookingEvent" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingEvent_booking_fkey" FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingEvent_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "BookingEvent_booking_created_idx" ON wewed_booking."BookingEvent"("bookingId","createdAt" DESC);

CREATE TABLE wewed_booking."ReferralEvent" (
  "id" TEXT PRIMARY KEY,
  "referralLinkId" TEXT NOT NULL,
  "bookingId" TEXT,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "anonymousSessionHash" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralEvent_type_check" CHECK ("eventType" IN ('open','catalog_view','availability_check','booking_started','booking_requested','booking_confirmed')),
  CONSTRAINT "ReferralEvent_link_fkey" FOREIGN KEY ("referralLinkId") REFERENCES wewed_booking."ReferralLink"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReferralEvent_booking_fkey" FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ReferralEvent_user_fkey" FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ReferralEvent_link_created_idx" ON wewed_booking."ReferralEvent"("referralLinkId","createdAt" DESC);
CREATE INDEX "ReferralEvent_booking_idx" ON wewed_booking."ReferralEvent"("bookingId") WHERE "bookingId" IS NOT NULL;

CREATE TABLE wewed_booking."AutoBookPolicy" (
  "id" TEXT PRIMARY KEY,
  "weddingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "maxAction" TEXT NOT NULL DEFAULT 'prepare',
  "maxPerBookingCents" INTEGER,
  "maxTotalOpenCents" INTEGER,
  "allowedCategories" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "allowNonRefundable" BOOLEAN NOT NULL DEFAULT false,
  "allowContractAcceptance" BOOLEAN NOT NULL DEFAULT false,
  "allowPayment" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutoBookPolicy_wedding_user_key" UNIQUE ("weddingId","userId"),
  CONSTRAINT "AutoBookPolicy_action_check" CHECK ("maxAction" IN ('suggest','prepare','hold','request','confirm')),
  CONSTRAINT "AutoBookPolicy_money_check" CHECK (("maxPerBookingCents" IS NULL OR "maxPerBookingCents" >= 0) AND ("maxTotalOpenCents" IS NULL OR "maxTotalOpenCents" >= 0)),
  -- Current release boundary: AI may never accept contracts or make payments.
  CONSTRAINT "AutoBookPolicy_no_ai_contract_acceptance" CHECK ("allowContractAcceptance" = false),
  CONSTRAINT "AutoBookPolicy_no_ai_payment" CHECK ("allowPayment" = false),
  CONSTRAINT "AutoBookPolicy_wedding_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AutoBookPolicy_user_fkey" FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION wewed_booking.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProviderCatalogItem_updatedAt" BEFORE UPDATE ON wewed_booking."ProviderCatalogItem" FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();
CREATE TRIGGER "ProviderCatalogVariant_updatedAt" BEFORE UPDATE ON wewed_booking."ProviderCatalogVariant" FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();
CREATE TRIGGER "ProviderCatalogMedia_updatedAt" BEFORE UPDATE ON wewed_booking."ProviderCatalogMedia" FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();
CREATE TRIGGER "BookingResource_updatedAt" BEFORE UPDATE ON wewed_booking."BookingResource" FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();
CREATE TRIGGER "AvailabilityRule_updatedAt" BEFORE UPDATE ON wewed_booking."AvailabilityRule" FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();
CREATE TRIGGER "Booking_updatedAt" BEFORE UPDATE ON wewed_booking."Booking" FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();
CREATE TRIGGER "BookingLine_updatedAt" BEFORE UPDATE ON wewed_booking."BookingLine" FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();
CREATE TRIGGER "BookingResourceAllocation_updatedAt" BEFORE UPDATE ON wewed_booking."BookingResourceAllocation" FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();
CREATE TRIGGER "AutoBookPolicy_updatedAt" BEFORE UPDATE ON wewed_booking."AutoBookPolicy" FOR EACH ROW EXECUTE FUNCTION wewed_booking.set_updated_at();

CREATE OR REPLACE FUNCTION wewed_booking.guard_resource_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, wewed_booking
AS $$
DECLARE
  resource_capacity INTEGER;
  resource_state TEXT;
  allocated INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."resourceId", 0));

  SELECT r."capacity", r."status"
    INTO resource_capacity, resource_state
  FROM wewed_booking."BookingResource" r
  WHERE r."id" = NEW."resourceId"
  FOR UPDATE;

  IF resource_capacity IS NULL THEN
    RAISE EXCEPTION 'booking_resource_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF resource_state <> 'active' THEN
    RAISE EXCEPTION 'booking_resource_unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF NEW."state" IN ('hold','confirmed') THEN
    SELECT COALESCE(SUM(a."quantity"), 0)::INTEGER
      INTO allocated
    FROM wewed_booking."BookingResourceAllocation" a
    WHERE a."resourceId" = NEW."resourceId"
      AND a."id" <> NEW."id"
      AND a."state" IN ('hold','confirmed')
      AND (a."state" = 'confirmed' OR a."expiresAt" > CURRENT_TIMESTAMP)
      AND a."startsAt" < NEW."endsAt"
      AND a."endsAt" > NEW."startsAt";

    IF allocated + NEW."quantity" > resource_capacity THEN
      RAISE EXCEPTION 'booking_resource_capacity_exceeded' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "BookingResourceAllocation_capacity_guard"
BEFORE INSERT OR UPDATE OF "resourceId","quantity","startsAt","endsAt","state","expiresAt"
ON wewed_booking."BookingResourceAllocation"
FOR EACH ROW EXECUTE FUNCTION wewed_booking.guard_resource_capacity();

-- No direct PostgREST access. Wewed application services are the authorization boundary.
REVOKE ALL ON ALL TABLES IN SCHEMA wewed_booking FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA wewed_booking FROM anon, authenticated, PUBLIC;