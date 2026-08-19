-- WW-CONTRIBUTIONS-2026-08-19-01 — legacy source-of-funds truth preservation
-- Existing EngagementPayment rows remain the payment facts. Budget-only paid amounts remain Budget facts.
-- No payer, payment timestamp, payment reference, or proof is fabricated by this migration.

INSERT INTO wewed_contributions.payment_funding_allocations
  (id, wedding_id, payment_id, source_kind, amount, currency, note, created_at, updated_at)
SELECT
  'wwc_legacy_payment_' || md5(p.id),
  se."weddingId",
  p.id,
  'LEGACY_UNATTRIBUTED',
  p.amount,
  p.currency,
  'Migration: payment existed before source-of-funds tracking; funding source not recorded.',
  NOW(),
  NOW()
FROM public."EngagementPayment" p
JOIN public."ServiceEngagement" se ON se.id = p."serviceEngagementId"
WHERE p.amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM wewed_contributions.payment_funding_allocations f
    WHERE f.payment_id = p.id
  );

-- A Budget paidAmount with no durable EngagementPayment stays a Budget-only historical fact.
-- If an EngagementPayment already exists for the linked ServiceEngagement, the payment-level row above is authoritative
-- and we do not duplicate the same economic fact at Budget level.
INSERT INTO wewed_contributions.payment_funding_allocations
  (id, wedding_id, budget_item_id, source_kind, amount, currency, note, created_at, updated_at)
SELECT
  'wwc_legacy_budget_' || md5(b.id),
  b."weddingId",
  b.id,
  'LEGACY_UNATTRIBUTED',
  b."paidAmount",
  b.currency,
  'Migration: Budget paidAmount existed without a durable payment/source record; funding source not recorded.',
  NOW(),
  NOW()
FROM public."BudgetItem" b
WHERE b."paidAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM wewed_contributions.payment_funding_allocations f
    WHERE f.budget_item_id = b.id
  )
  AND (
    b."serviceEngagementId" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public."EngagementPayment" p
      WHERE p."serviceEngagementId" = b."serviceEngagementId"
    )
  );
