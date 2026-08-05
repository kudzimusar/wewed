-- Keep distributed AI rate-limit hashes inaccessible through Supabase client roles.
-- Server-side Prisma uses the database owner/service role and remains operational.
-- Supabase-specific roles are checked conditionally so this additive migration
-- also applies cleanly to ordinary PostgreSQL test and development databases.

ALTER TABLE public."AiRateLimitBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AiRateLimitBucket" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public."AiRateLimitBucket" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public."AiRateLimitBucket" FROM authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    GRANT ALL ON TABLE public."AiRateLimitBucket" TO postgres;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public."AiRateLimitBucket" TO service_role;
  END IF;
END
$$;
