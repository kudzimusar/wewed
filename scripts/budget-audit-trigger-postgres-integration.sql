\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public."Couple" (
  id, slug, "partner1", "partner2", "createdAt", "updatedAt"
) VALUES (
  'budget-audit-test-couple',
  'budget-audit-test-couple',
  'Audit',
  'Test',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO public."Wedding" (
  id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "createdAt", "updatedAt"
) VALUES (
  'budget-audit-test-wedding',
  'budget-audit-test-wedding',
  'Budget Audit Test',
  TIMESTAMP '2027-01-01 12:00:00',
  'Test Venue',
  'Harare',
  'Zimbabwe',
  'budget-audit-test-couple',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO public."BudgetItem" (
  id, category, description, "estimatedCost", "actualCost", "paidAmount",
  currency, "weddingId", "createdAt", "updatedAt"
) VALUES (
  'budget-audit-test-item',
  'venue',
  'Audit trigger test item',
  1000,
  900,
  100,
  'USD',
  'budget-audit-test-wedding',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

UPDATE public."BudgetItem"
SET "paidAmount" = 250,
    notes = 'Deposit corrected',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 'budget-audit-test-item';

DELETE FROM public."BudgetItem"
WHERE id = 'budget-audit-test-item';

DO $$
DECLARE
  inserted_count integer;
  updated_count integer;
  deleted_count integer;
  update_before jsonb;
  update_after jsonb;
  delete_before jsonb;
  delete_after text;
BEGIN
  SELECT COUNT(*) INTO inserted_count
  FROM public."AuditEvent"
  WHERE "weddingId" = 'budget-audit-test-wedding'
    AND "resourceId" = 'budget-audit-test-item'
    AND action = 'budget.db_insert';

  SELECT COUNT(*) INTO updated_count
  FROM public."AuditEvent"
  WHERE "weddingId" = 'budget-audit-test-wedding'
    AND "resourceId" = 'budget-audit-test-item'
    AND action = 'budget.db_update';

  SELECT "beforeValue"::jsonb, "afterValue"::jsonb
  INTO update_before, update_after
  FROM public."AuditEvent"
  WHERE "weddingId" = 'budget-audit-test-wedding'
    AND "resourceId" = 'budget-audit-test-item'
    AND action = 'budget.db_update'
  ORDER BY "createdAt" DESC
  LIMIT 1;

  SELECT COUNT(*) INTO deleted_count
  FROM public."AuditEvent"
  WHERE "weddingId" = 'budget-audit-test-wedding'
    AND "resourceId" = 'budget-audit-test-item'
    AND action = 'budget.db_delete';

  SELECT "beforeValue"::jsonb, "afterValue"
  INTO delete_before, delete_after
  FROM public."AuditEvent"
  WHERE "weddingId" = 'budget-audit-test-wedding'
    AND "resourceId" = 'budget-audit-test-item'
    AND action = 'budget.db_delete'
  ORDER BY "createdAt" DESC
  LIMIT 1;

  IF inserted_count <> 1 THEN
    RAISE EXCEPTION 'Expected one Budget insert audit, found %', inserted_count;
  END IF;

  IF updated_count <> 1 THEN
    RAISE EXCEPTION 'Expected one Budget update audit, found %', updated_count;
  END IF;

  IF (update_before->>'paidAmount')::numeric <> 100
     OR (update_after->>'paidAmount')::numeric <> 250
     OR update_after->>'notes' <> 'Deposit corrected' THEN
    RAISE EXCEPTION 'Budget update audit does not contain the exact before/after values';
  END IF;

  IF deleted_count <> 1 THEN
    RAISE EXCEPTION 'Expected one Budget delete audit, found %', deleted_count;
  END IF;

  IF (delete_before->>'paidAmount')::numeric <> 250 OR delete_after IS NOT NULL THEN
    RAISE EXCEPTION 'Budget delete audit does not contain the final row snapshot';
  END IF;
END;
$$;

ROLLBACK;
