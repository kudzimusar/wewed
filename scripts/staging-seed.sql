\set ON_ERROR_STOP on
SET search_path TO staging;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staging._wewed_environment
    WHERE id = 1 AND environment = 'staging' AND reset_allowed = true
  ) THEN
    RAISE EXCEPTION 'Refusing seed: staging safety marker missing';
  END IF;
END $$;

INSERT INTO "Couple" (id, slug, partner1, partner2, surname, "subscriptionStatus", "createdAt", "updatedAt")
VALUES ('seed-couple-001', 'alex-and-jordan-test', 'Alex', 'Jordan', 'Example', 'active', now(), now());

INSERT INTO "Wedding" (id, slug, title, monogram, tagline, date, venue, "venueCity", "venueCountry", "primaryColor", "accentColor", "memoryColor", "backgroundColor", lifecycle, privacy, "canonSealed", "subscriptionTier", "coupleId", "createdAt", "updatedAt")
VALUES ('seed-wedding-001', 'alex-and-jordan-test', 'Alex & Jordan — Test Wedding', 'A&J', 'Synthetic staging data', '2027-05-22T13:00:00Z', 'Willow Test Estate', 'Harare', 'Zimbabwe', '#BF9B5F', '#C0633F', '#6B2D3A', '#FBF6EE', 'before', 'private', false, 'canon', 'seed-couple-001', now(), now());

INSERT INTO "SeatingTable" (id, name, capacity, position, "weddingId", "createdAt", "updatedAt") VALUES
('seed-table-001', 'Family Table', 8, '{"x":100,"y":100}', 'seed-wedding-001', now(), now()),
('seed-table-002', 'Friends Table', 8, '{"x":300,"y":100}', 'seed-wedding-001', now(), now());

INSERT INTO "Guest" (id, name, email, phone, role, "roleDetail", side, "seatingTableId", "contributionStatus", "weddingId", "createdAt", "updatedAt") VALUES
('seed-guest-001', 'Taylor Morgan', 'taylor.morgan@example.test', '+263000000001', 'family', 'Parent', 'partner1', 'seed-table-001', 'none', 'seed-wedding-001', now(), now()),
('seed-guest-002', 'Casey Ndlovu', 'casey.ndlovu@example.test', '+263000000002', 'bridal_party', 'Best Person', 'partner2', 'seed-table-002', 'none', 'seed-wedding-001', now(), now()),
('seed-guest-003', 'Riley Chen', 'riley.chen@example.test', '+263000000003', 'guest', null, null, null, 'none', 'seed-wedding-001', now(), now()),
('seed-guest-004', 'Sam Okafor', 'sam.okafor@example.test', '+263000000004', 'guest', null, null, null, 'none', 'seed-wedding-001', now(), now());

INSERT INTO "RSVP" (id, token, attending, "mealChoice", "plusOne", "plusOneName", "kidsAttending", "kidsCount", "dietaryNotes", "checkedIn", "guestId", "createdAt", "updatedAt") VALUES
('seed-rsvp-001', 'test-rsvp-taylor-001', true, 'vegetarian', false, null, false, 0, 'Nut allergy', false, 'seed-guest-001', now(), now()),
('seed-rsvp-002', 'test-rsvp-casey-002', true, 'traditional', true, 'Jamie Example', false, 0, null, false, 'seed-guest-002', now(), now()),
('seed-rsvp-003', 'test-rsvp-riley-003', null, null, false, null, false, 0, null, false, 'seed-guest-003', now(), now()),
('seed-rsvp-004', 'test-rsvp-sam-004', false, null, false, null, false, 0, null, false, 'seed-guest-004', now(), now());

INSERT INTO "Vendor" (id, name, category, description, website, phone, rating, featured, "weddingId", "createdAt", "updatedAt") VALUES
('seed-vendor-001', 'Willow Test Estate', 'venue', 'Synthetic venue used only for staging.', 'https://example.test/venue', '+263000001001', 4.7, true, 'seed-wedding-001', now(), now()),
('seed-vendor-002', 'Sample Bloom Studio', 'florist', 'Synthetic florist record.', 'https://example.test/florist', '+263000001002', 4.5, false, 'seed-wedding-001', now(), now()),
('seed-vendor-003', 'Demo Light Photography', 'photographer', 'Synthetic photography record.', 'https://example.test/photo', '+263000001003', 4.8, false, 'seed-wedding-001', now(), now());

INSERT INTO "PlannerTask" (id, title, description, category, status, priority, "dueDate", assignee, "order", "weddingId", "createdAt", "updatedAt") VALUES
('seed-task-001', 'Confirm test venue contract', 'Validate planner task editing and completion.', 'venue', 'in_progress', 'high', '2026-09-01T09:00:00Z', 'Planner Tester', 1, 'seed-wedding-001', now(), now()),
('seed-task-002', 'Review synthetic guest list', 'Check RSVP, dietary, and seating data.', 'other', 'todo', 'high', '2026-09-10T09:00:00Z', 'Planner Tester', 2, 'seed-wedding-001', now(), now()),
('seed-task-003', 'Approve sample floral mood', 'Synthetic vendor coordination task.', 'decor', 'todo', 'medium', '2026-10-01T09:00:00Z', 'Alex', 3, 'seed-wedding-001', now(), now());

INSERT INTO "BudgetItem" (id, category, description, "estimatedCost", "actualCost", "paidAmount", currency, "vendorId", "dueDate", "weddingId", "createdAt", "updatedAt") VALUES
('seed-budget-001', 'venue', 'Synthetic venue booking', 5000, 4800, 2400, 'USD', 'seed-vendor-001', '2026-10-15T00:00:00Z', 'seed-wedding-001', now(), now()),
('seed-budget-002', 'decor', 'Synthetic floral package', 1800, null, 300, 'USD', 'seed-vendor-002', '2027-02-01T00:00:00Z', 'seed-wedding-001', now(), now());

INSERT INTO "ProgrammeItem" (id, time, title, description, icon, "order", "weddingId", "createdAt", "updatedAt") VALUES
('seed-programme-001', '13:00', 'Vendor arrival', 'Synthetic day-of timeline entry.', 'Truck', 1, 'seed-wedding-001', now(), now()),
('seed-programme-002', '15:00', 'Ceremony', 'Test ceremony run sheet.', 'Heart', 2, 'seed-wedding-001', now(), now()),
('seed-programme-003', '17:00', 'Reception', 'Test reception run sheet.', 'Music', 3, 'seed-wedding-001', now(), now());

SELECT 'staging_seed_complete' AS result,
       (SELECT count(*) FROM "Guest" WHERE "weddingId" = 'seed-wedding-001') AS guests,
       (SELECT count(*) FROM "Vendor" WHERE "weddingId" = 'seed-wedding-001') AS vendors,
       (SELECT count(*) FROM "PlannerTask" WHERE "weddingId" = 'seed-wedding-001') AS tasks;
