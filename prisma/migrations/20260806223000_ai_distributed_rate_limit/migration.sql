-- Distributed, privacy-preserving AI rate limiting.
-- This table is additive and contains only hashed request-scope keys.

CREATE TABLE IF NOT EXISTS public."AiRateLimitBucket" (
  "keyHash" TEXT NOT NULL,
  "windowStart" TIMESTAMPTZ NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "AiRateLimitBucket_pkey" PRIMARY KEY ("keyHash", "windowStart"),
  CONSTRAINT "AiRateLimitBucket_count_check" CHECK ("count" > 0)
);

CREATE INDEX IF NOT EXISTS "AiRateLimitBucket_expiresAt_idx"
ON public."AiRateLimitBucket" ("expiresAt");
