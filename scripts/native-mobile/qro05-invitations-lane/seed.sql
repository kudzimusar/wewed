BEGIN;
INSERT INTO public."User" (id, email, name, role, "isActive", "updatedAt") VALUES ('e2e-planner', 'qro05-planner@example.test', 'E2E Planner', 'planner', true, now());
INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ('e2e-couple', 'e2e-couple', 'Rudo', 'Tendai', now());
INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "invitationCardStyle", "invitationCardMessage", "rsvpDeadline", "updatedAt")
  VALUES ('e2e-wedding', 'qro05-e2e', 'Rudo & Tendai', now() + interval '90 days', 'Qualification Venue', 'Harare', 'Zimbabwe', 'e2e-couple', 'ivory-floral-gold', 'Together with our families, we invite you.', '2026-12-01T00:00:00Z', now());
INSERT INTO public."WeddingContent" (id, "weddingId", section, field, value, "updatedAt") VALUES ('e2e-children', 'e2e-wedding', 'rsvp', 'childrenPolicy', 'adults_only', now());
INSERT INTO public."WeddingMembership" (id, "userId", "weddingId", role, status, "updatedAt") VALUES ('e2e-membership', 'e2e-planner', 'e2e-wedding', 'planner', 'active', now());
INSERT INTO public."Guest" (id, name, "weddingId", "tableNumber", "updatedAt") VALUES
  ('e2e-g1', 'Amara Attending', 'e2e-wedding', 1, now()),
  ('e2e-g2', 'Bongani Attending', 'e2e-wedding', 2, now()),
  ('e2e-g3', 'Chipo Declined', 'e2e-wedding', NULL, now()),
  ('e2e-g4', 'Dumi Pending', 'e2e-wedding', 3, now()),
  ('e2e-g5', 'Eli Pending', 'e2e-wedding', NULL, now()),
  ('e2e-g6', 'Farai Unlinked', 'e2e-wedding', NULL, now());
INSERT INTO public."RSVP" (id, token, "guestId", attending, "updatedAt") VALUES
  ('e2e-r1', 'e2e-token-g1', 'e2e-g1', true, now()),
  ('e2e-r2', 'e2e-token-g2', 'e2e-g2', true, now()),
  ('e2e-r3', 'e2e-token-g3', 'e2e-g3', false, now()),
  ('e2e-r4', 'e2e-token-g4', 'e2e-g4', NULL, now()),
  ('e2e-r5', 'e2e-token-g5', 'e2e-g5', NULL, now());
INSERT INTO public."QRDestination" (id, label, url, type, "scanCount", "isActive", "weddingId", "updatedAt")
  VALUES ('print_QROFIVE234', 'Printed invitation', 'https://wewed.pro/i/QROFIVE234', 'physical_invitation', 11, true, 'e2e-wedding', now());
COMMIT;
