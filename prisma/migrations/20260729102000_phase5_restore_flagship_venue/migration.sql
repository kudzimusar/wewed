-- Phase 5: preserve the first live client's venue record as durable, structured data.
-- The lookup is by stable wedding slug; no generated database IDs are embedded.

UPDATE public."Wedding"
SET
  venue = 'Imba Manor',
  "venueCity" = 'Harare',
  "venueCountry" = 'Zimbabwe',
  "venueMapUrl" = 'https://www.google.com/maps/search/?api=1&query=Imba%20Manor%20Wedding%20%26%20Conference%20Venue%2C%201%20Worplestone%20Way%2C%20Glen%20Lorne%2C%20Harare%2C%20Zimbabwe',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE slug = 'charity-and-kudzie';

INSERT INTO public."WeddingContent" (
  id,
  "weddingId",
  section,
  field,
  value,
  "order",
  metadata,
  "createdAt",
  "updatedAt"
)
SELECT
  'phase5-venue-' || substr(md5(w.id || values_to_restore.field), 1, 20),
  w.id,
  'venue',
  values_to_restore.field,
  values_to_restore.value,
  values_to_restore.sort_order,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM public."Wedding" w
CROSS JOIN (
  VALUES
    ('heading', 'Imba Manor', 0),
    ('subtitle', 'Our chosen sanctuary — where forever begins', 0),
    ('address', '1 Worplestone Way', 0),
    ('suburb', 'Glen Lorne', 0),
    ('cityCountry', 'Harare, Zimbabwe', 0),
    ('phone', '+263 77 108 1903', 0),
    ('website', 'http://www.oreacevents.co.zw/', 0),
    ('aboutEyebrow', 'About the Venue', 0),
    ('aboutHeading', 'A garden venue for Charity & Kudzie’s celebration', 0),
    ('description', 'Situated at 1 Worplestone Way in Glen Lorne, Harare, Imba Manor is the confirmed wedding and conference venue for Charity and Kudzie’s ceremony and reception on 23 December 2026. The saved venue record gives guests a verified street address, direct contact number, and directions link while retaining the couple’s existing ceremony, reception, and guest-experience details.', 0),
    ('imageAlt', 'Imba Manor wedding and conference venue in Glen Lorne, Harare', 0),
    ('imageCaption', 'Imba Manor · Glen Lorne · Harare, Zimbabwe', 0),
    ('imageTitle', 'Charity & Kudzie · 23 December 2026', 0),
    ('exploreLabel', 'Explore Imba Manor', 0),
    ('directionsLabel', 'Get Directions', 0)
) AS values_to_restore(field, value, sort_order)
WHERE w.slug = 'charity-and-kudzie'
ON CONFLICT ("weddingId", section, field)
DO UPDATE SET
  value = EXCLUDED.value,
  "order" = EXCLUDED."order",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO public."AuditEvent" (
  id,
  action,
  "resourceType",
  "resourceId",
  "afterValue",
  "weddingId",
  "createdAt"
)
SELECT
  'phase5-venue-audit-' || substr(md5(w.id), 1, 16),
  'first_client.venue_restored',
  'wedding',
  w.id,
  json_build_object(
    'venue', w.venue,
    'address', '1 Worplestone Way',
    'suburb', 'Glen Lorne',
    'city', w."venueCity",
    'country', w."venueCountry",
    'phone', '+263 77 108 1903',
    'source', 'phase5_real_client_data'
  )::text,
  w.id,
  CURRENT_TIMESTAMP
FROM public."Wedding" w
WHERE w.slug = 'charity-and-kudzie'
ON CONFLICT (id) DO UPDATE SET
  "afterValue" = EXCLUDED."afterValue";
