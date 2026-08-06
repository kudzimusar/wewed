\set ON_ERROR_STOP on

INSERT INTO public."Couple" (
  id,
  slug,
  partner1,
  partner2,
  "createdAt",
  "updatedAt"
) VALUES (
  'ci-ai-couple',
  'ci-ai-couple',
  'Amina',
  'Tariro',
  now(),
  now()
);

INSERT INTO public."Wedding" (
  id,
  slug,
  title,
  date,
  venue,
  "venueCity",
  "venueCountry",
  lifecycle,
  privacy,
  "coupleId",
  "createdAt",
  "updatedAt"
) VALUES (
  'ci-ai-wedding',
  'ci-ai-wedding',
  'Amina & Tariro',
  '2027-06-19T12:00:00.000Z',
  'CI Garden Venue',
  'Harare',
  'Zimbabwe',
  'planning',
  'link_only',
  'ci-ai-couple',
  now(),
  now()
);

INSERT INTO public."User" (
  id,
  email,
  name,
  role,
  "coupleId",
  "currentWeddingId",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  'ci-ai-user',
  'ai-runtime@wewed.test',
  'AI Runtime Planner',
  'planner',
  'ci-ai-couple',
  'ci-ai-wedding',
  true,
  now(),
  now()
);

INSERT INTO public."WeddingMembership" (
  id,
  "userId",
  "weddingId",
  role,
  status,
  permissions,
  "acceptedAt",
  "createdAt",
  "updatedAt"
) VALUES (
  'ci-ai-membership',
  'ci-ai-user',
  'ci-ai-wedding',
  'owner',
  'active',
  '["*"]',
  now(),
  now(),
  now()
);

INSERT INTO public."ProgrammeItem" (
  id,
  time,
  title,
  description,
  duration,
  location,
  "order",
  "weddingId",
  "createdAt",
  "updatedAt"
) VALUES (
  'ci-ai-programme-1',
  '14:00',
  'Wedding ceremony',
  'Guests should arrive by 13:30.',
  '60 min',
  'Main garden',
  1,
  'ci-ai-wedding',
  now(),
  now()
);

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
) VALUES
(
  'ci-ai-public-faq',
  'ci-ai-wedding',
  'faq',
  'dress-code',
  'Formal attire with colourful African accents is welcome.',
  1,
  '{"visibility":"public","published":true}',
  now(),
  now()
),
(
  'ci-ai-public-doc-chunk',
  'ci-ai-wedding',
  'ai_document_chunk',
  'ci-public-document:0000',
  '{"documentId":"ci-public-document","title":"Published guest guide","text":"The guest shuttle leaves the city centre at 12:30.","visibility":"public","chunkIndex":0}',
  0,
  '{"visibility":"public","published":true}',
  now(),
  now()
),
(
  'ci-ai-private-doc-chunk',
  'ci-ai-wedding',
  'ai_document_chunk',
  'ci-private-document:0000',
  '{"documentId":"ci-private-document","title":"Private supplier note","text":"The private supplier access code is confidential.","visibility":"private","chunkIndex":0}',
  0,
  '{"visibility":"private","published":false}',
  now(),
  now()
);
