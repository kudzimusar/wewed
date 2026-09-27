BEGIN;
INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES
 ('q6-couple', 'q6-couple', 'Rudo', 'Tendai', now()),
 ('q6-couple-w', 'q6-couple-w', 'Nyasha', 'Farai', now());
INSERT INTO public."Wedding" (id, slug, title, monogram, tagline, date, venue, "venueCity", "venueCountry", "venueMapUrl", "coupleId", "invitationCardStyle", "invitationCardMessage", "rsvpDeadline", privacy, "updatedAt") VALUES
 ('q6-wedding', 'qro06-rudo-tendai', 'Rudo & Tendai', 'R&T', 'Together, forever', date_trunc('day', now()) + interval '88 days' + interval '14 hours', 'Qualification Manor', 'Harare', 'Zimbabwe', 'https://maps.google.com/?q=Qualification+Manor+Harare', 'q6-couple', 'ivory-floral-gold', 'With joy in our hearts, we would love you to celebrate with us.', date_trunc('day', now()) + interval '60 days', 'link_only', now()),
 ('q6-window', 'qro06-window', 'Nyasha & Farai', 'N&F', NULL, date_trunc('day', now()) + interval '7 days' + interval '14 hours', 'Window Gardens', 'Harare', 'Zimbabwe', NULL, 'q6-couple-w', 'ivory-floral-gold', NULL, NULL, 'link_only', now());
INSERT INTO public."WeddingContent" (id, "weddingId", section, field, value, "updatedAt") VALUES ('q6-children', 'q6-wedding', 'rsvp', 'childrenPolicy', 'adults_only', now());
INSERT INTO public."SeatingTable" (id, name, capacity, "weddingId", "updatedAt") VALUES ('q6-table-acacia', 'Acacia', 8, 'q6-wedding', now()), ('q6-table-w', 'Baobab', 8, 'q6-window', now());
INSERT INTO public."ProgrammeItem" (id, time, title, description, location, "order", "weddingId", "updatedAt") VALUES
 ('q6-p1', '14:00', 'Ceremony', 'Vows under the jacaranda', 'Garden Lawn', 1, 'q6-wedding', now()),
 ('q6-p2', '16:00', 'Photographs', NULL, 'Rose Terrace', 2, 'q6-wedding', now()),
 ('q6-p3', '18:00', 'Reception', 'Dinner and speeches', 'Grand Hall', 3, 'q6-wedding', now()),
 ('q6-p4', '21:00', 'First Dance', NULL, 'Grand Hall', 4, 'q6-wedding', now());
INSERT INTO public."Guest" (id, name, email, "tableNumber", "seatingTableId", "weddingId", "updatedAt") VALUES
 ('q6-pending', 'Tariro Pending', 'tariro@example.test', NULL, NULL, 'q6-wedding', now()),
 ('q6-attending', 'Chipo Attending', 'chipo@example.test', 4, 'q6-table-acacia', 'q6-wedding', now()),
 ('q6-declined', 'Kuda Declined', 'kuda@example.test', NULL, NULL, 'q6-wedding', now()),
 ('q6-window-guest', 'Rufaro Window', 'rufaro@example.test', 2, 'q6-table-w', 'q6-window', now());
INSERT INTO public."RSVP" (id, token, "guestId", attending, "mealChoice", "plusOne", "plusOneName", "plusOneMeal", "dietaryNotes", message, "updatedAt") VALUES
 ('q6-r-pending', 'q6tok-pending-7c1e9a4f2b', 'q6-pending', NULL, NULL, false, NULL, NULL, NULL, NULL, now()),
 ('q6-r-attending', 'q6tok-attending-5d8b2e7a1c', 'q6-attending', true, 'Beef', true, 'Tawanda', 'Chicken', 'No nuts', 'So happy for you both!', now()),
 ('q6-r-declined', 'q6tok-declined-3a9f6c2d8e', 'q6-declined', false, NULL, false, NULL, NULL, NULL, 'Sorry to miss it, sending love.', now()),
 ('q6-r-window', 'q6tok-window-1b4e7f9a2c', 'q6-window-guest', true, 'Vegetarian', false, NULL, NULL, NULL, NULL, now());
COMMIT;
-- Extra pending Guest used by the RSVP-submission journey (reset to pending before each run).
INSERT INTO public."Guest" (id, name, email, "weddingId", "updatedAt") VALUES ('q6-rsvp', 'Nyasha Replies', 'nyasha@example.test', 'q6-wedding', now());
INSERT INTO public."RSVP" (id, token, "guestId", attending, "updatedAt") VALUES ('q6-r-rsvp', 'q6tok-rsvp-9e2c4a7b1d', 'q6-rsvp', NULL, now());
