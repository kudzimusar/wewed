-- Keep membership assignments inaccessible through the public PostgREST surface.
-- Planner access is resolved by signed server sessions through the Next.js API.

ALTER TABLE "WeddingMembership" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "WeddingMembership" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "WeddingMembership" FROM authenticated;
  END IF;
END $$;
