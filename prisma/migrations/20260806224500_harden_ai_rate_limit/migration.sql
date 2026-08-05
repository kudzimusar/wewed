-- Keep distributed AI rate-limit hashes inaccessible through Supabase client roles.
-- Server-side Prisma uses the database owner/service role and remains operational.

ALTER TABLE public."AiRateLimitBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AiRateLimitBucket" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."AiRateLimitBucket" FROM anon;
REVOKE ALL ON TABLE public."AiRateLimitBucket" FROM authenticated;
GRANT ALL ON TABLE public."AiRateLimitBucket" TO postgres;
GRANT ALL ON TABLE public."AiRateLimitBucket" TO service_role;
