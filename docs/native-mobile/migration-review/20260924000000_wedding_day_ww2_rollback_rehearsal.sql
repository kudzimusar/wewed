-- DESTRUCTIVE DISPOSABLE-DB REHEARSAL ONLY.
-- NOT AUTHORIZED FOR PRODUCTION.
--
-- Before invoking in psql on a disposable clone/session:
--   SET wewed.phase11a_disposable_rehearsal = 'YES';
-- This guard intentionally aborts otherwise.

DO $$
BEGIN
  IF COALESCE(current_setting('wewed.phase11a_disposable_rehearsal', true), '') <> 'YES' THEN
    RAISE EXCEPTION 'Refusing Phase 11A rollback: set wewed.phase11a_disposable_rehearsal=YES in a disposable session';
  END IF;
END $$;

BEGIN;

DROP TABLE IF EXISTS public."WeddingCheckIn";
DROP TABLE IF EXISTS public."WeddingPassCredential";
DROP TABLE IF EXISTS public."WeddingPassKey";

ALTER TABLE public."Guest"
  DROP CONSTRAINT IF EXISTS "Guest_id_weddingId_key";

DELETE FROM public."_prisma_migrations"
 WHERE migration_name = '20260924000000_wedding_day_ww2_authority';

COMMIT;
