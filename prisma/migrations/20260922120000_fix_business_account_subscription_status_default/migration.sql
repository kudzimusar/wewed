-- Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 7 — fixes carry-forward finding F-4.
--
-- wewed_admin."BusinessAccount"."subscriptionStatus" has been NOT NULL DEFAULT 'inactive' since the
-- column was created in migration 20260730173000_wewed_business_admin_console. The very same
-- migration's own backfill of legacy rows already treats 'free' as the correct fallback value
-- ("COALESCE(NULLIF(c.subscriptionStatus, ''), 'free')"), and the CHECK constraint added minutes
-- later by 20260730224000_harden_wewed_data_pipeline has never included 'inactive' in its allowed
-- list. Any insert that relies on the column default therefore fails outright:
--
--   ERROR: new row for relation "BusinessAccount" violates check constraint
--   "BusinessAccount_subscription_status_check"
--
-- reproduced against a disposable database migrated with this repository's own migration chain.
-- Phase 3 found existing production rows clean (none actually hold 'inactive'), which is exactly
-- why this had not surfaced: every existing writer already passes an explicit, valid value. This
-- migration only changes what a FUTURE insert gets when it omits the column; it does not touch any
-- existing row, so no production data rewrite is required or performed here.
ALTER TABLE wewed_admin."BusinessAccount"
  ALTER COLUMN "subscriptionStatus" SET DEFAULT 'free';
