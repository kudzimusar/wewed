ALTER TABLE "Wedding"
  DROP CONSTRAINT IF EXISTS "Wedding_invitationCardStyle_check";

ALTER TABLE "Wedding"
  ADD CONSTRAINT "Wedding_invitationCardStyle_check"
  CHECK (
    "invitationCardStyle" IN (
      'ivory-floral-gold',
      'botanical',
      'editorial',
      'midnight',
      'royal-emerald',
      'classic-white',
      'blush-romance',
      'african-luxe',
      'black-tie',
      'watercolour-garden',
      'sunset-terracotta',
      'celestial'
    )
  );
