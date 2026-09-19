-- Keep database validation aligned with src/lib/digital-invitation-card.ts.
-- Existing deployments may have an older CHECK that only allows the legacy
-- botanical/editorial/midnight values. Replace only CHECK constraints that
-- explicitly reference Wedding.invitationCardStyle.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"Wedding"'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%invitationCardStyle%'
  LOOP
    EXECUTE format('ALTER TABLE "Wedding" DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE "Wedding"
  ADD CONSTRAINT "Wedding_invitationCardStyle_check"
  CHECK (
    "invitationCardStyle" IN (
      'ivory-floral-gold',
      'midnight',
      'botanical',
      'royal-emerald',
      'classic-white',
      'blush-romance',
      'african-luxe',
      'editorial',
      'black-tie',
      'watercolour-garden',
      'sunset-terracotta',
      'celestial'
    )
  );
