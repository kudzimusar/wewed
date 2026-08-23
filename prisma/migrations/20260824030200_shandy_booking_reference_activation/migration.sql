-- Activate Shandy Weddings & Events as the first booking reference vendor without fabricating
-- price, inventory, sizes, colours or availability. These catalogue shells are derived from
-- Shandy's already-published offerings and remain request/quote based until the vendor records
-- verified item-level commercial data through the booking catalogue manager.

INSERT INTO wewed_booking."ProviderCatalogItem"
  (id,"offeringId",slug,name,description,"bookingArchetype","bookingMode",status,"basePriceCents",currency,"pricingUnit","holdMinutes","bufferBeforeMinutes","bufferAfterMinutes","requiresFitting","requiresContract",attributes,"availabilityPolicy","sortOrder","publishedAt")
SELECT
  'catalog-shandy-attire-reference',
  o.id,
  'wedding-gowns-bridal-accessories',
  o."displayName",
  COALESCE(NULLIF(o."shortDescription",''),'Browse Shandy wedding gowns and bridal accessories, then request the exact gown, fitting and hire details you need.'),
  'hybrid',
  'quote',
  'published',
  NULL,
  COALESCE(NULLIF(o.currency,''),'USD'),
  NULL,
  15,
  0,
  0,
  true,
  true,
  jsonb_build_object('referenceVendor',true,'catalogueState','vendor_details_required','sourceOfferingId',o.id),
  jsonb_build_object('availabilityConfidence','vendor_confirmation_required'),
  10,
  CURRENT_TIMESTAMP
FROM wewed_admin."ProviderServiceOffering" o
WHERE o.id='offering-shandy-attire' AND o."businessAccountId"='business-shandy-weddings-events' AND o.status='published'
ON CONFLICT ("offeringId",slug) DO NOTHING;

INSERT INTO wewed_booking."ProviderCatalogItem"
  (id,"offeringId",slug,name,description,"bookingArchetype","bookingMode",status,"basePriceCents",currency,"pricingUnit","minQuantity","holdMinutes","bufferBeforeMinutes","bufferAfterMinutes","requiresFitting","requiresContract",attributes,"availabilityPolicy","sortOrder","publishedAt")
SELECT
  'catalog-shandy-decor-reference',
  o.id,
  'chairs-event-rental-essentials',
  o."displayName",
  COALESCE(NULLIF(o."shortDescription",''),'Request chairs and event rental essentials for your wedding. Exact quantity, stock and delivery details are confirmed by Shandy before booking.'),
  'quantity_rental',
  'quote',
  'published',
  NULL,
  COALESCE(NULLIF(o.currency,''),'USD'),
  'item',
  1,
  15,
  0,
  0,
  false,
  true,
  jsonb_build_object('referenceVendor',true,'catalogueState','vendor_details_required','sourceOfferingId',o.id),
  jsonb_build_object('availabilityConfidence','vendor_confirmation_required'),
  20,
  CURRENT_TIMESTAMP
FROM wewed_admin."ProviderServiceOffering" o
WHERE o.id='offering-shandy-decor' AND o."businessAccountId"='business-shandy-weddings-events' AND o.status='published'
ON CONFLICT ("offeringId",slug) DO NOTHING;

INSERT INTO wewed_booking."ProviderCatalogItem"
  (id,"offeringId",slug,name,description,"bookingArchetype","bookingMode",status,"basePriceCents",currency,"pricingUnit","minQuantity","holdMinutes","bufferBeforeMinutes","bufferAfterMinutes","requiresFitting","requiresContract",attributes,"availabilityPolicy","sortOrder","publishedAt")
SELECT
  'catalog-shandy-tents-reference',
  o.id,
  'wedding-tents-marquee-hire',
  o."displayName",
  COALESCE(NULLIF(o."shortDescription",''),'Request wedding tent and marquee hire. Size, capacity, setup, delivery, date availability and price are confirmed by Shandy before booking.'),
  'quantity_rental',
  'quote',
  'published',
  NULL,
  COALESCE(NULLIF(o.currency,''),'USD'),
  'unit',
  1,
  15,
  0,
  0,
  false,
  true,
  jsonb_build_object('referenceVendor',true,'catalogueState','vendor_details_required','sourceOfferingId',o.id),
  jsonb_build_object('availabilityConfidence','vendor_confirmation_required'),
  30,
  CURRENT_TIMESTAMP
FROM wewed_admin."ProviderServiceOffering" o
WHERE o.id='offering-shandy-tents' AND o."businessAccountId"='business-shandy-weddings-events' AND o.status='published'
ON CONFLICT ("offeringId",slug) DO NOTHING;
