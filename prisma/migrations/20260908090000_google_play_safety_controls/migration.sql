-- User-content and generative-AI safety controls required for the Play release.
-- These records are server-only; browser database roles cannot access them.

CREATE SCHEMA IF NOT EXISTS wewed_safety;
REVOKE ALL ON SCHEMA wewed_safety FROM PUBLIC;

DO $wewed_safety_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_safety FROM %I', role_name);
    END IF;
  END LOOP;
END
$wewed_safety_roles$;

CREATE TABLE wewed_safety."UserBlock" (
  "id" text PRIMARY KEY,
  "blockerUserId" text NOT NULL,
  "blockedUserId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UserBlock_blockerUserId_fkey"
    FOREIGN KEY ("blockerUserId") REFERENCES public."User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserBlock_blockedUserId_fkey"
    FOREIGN KEY ("blockedUserId") REFERENCES public."User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserBlock_users_distinct" CHECK ("blockerUserId" <> "blockedUserId"),
  CONSTRAINT "UserBlock_pair_key" UNIQUE ("blockerUserId", "blockedUserId")
);

CREATE TABLE wewed_safety."SafetyReport" (
  "id" text PRIMARY KEY,
  "reporterUserId" text,
  "reporterFingerprint" text,
  "subjectType" text NOT NULL CHECK ("subjectType" IN ('COMMUNICATION_MESSAGE', 'COMMUNICATION_USER', 'AI_OUTPUT')),
  "conversationId" text,
  "messageId" text,
  "targetUserId" text,
  "sourceArea" text,
  "sourceId" text,
  "reason" text NOT NULL CHECK ("reason" IN ('HARASSMENT', 'HATE', 'SEXUAL', 'VIOLENCE', 'SPAM', 'SCAM', 'PRIVACY', 'DANGEROUS', 'INACCURATE_AI', 'OTHER')),
  "details" text,
  "contentSnapshot" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "SafetyReport_reporterUserId_fkey"
    FOREIGN KEY ("reporterUserId") REFERENCES public."User"("id") ON DELETE CASCADE,
  CONSTRAINT "SafetyReport_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES wewed_communications."CommunicationConversation"("id") ON DELETE CASCADE,
  CONSTRAINT "SafetyReport_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES wewed_communications."CommunicationMessage"("id") ON DELETE CASCADE,
  CONSTRAINT "SafetyReport_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES public."User"("id") ON DELETE SET NULL,
  CONSTRAINT "SafetyReport_details_length" CHECK ("details" IS NULL OR char_length("details") <= 1000),
  CONSTRAINT "SafetyReport_snapshot_length" CHECK ("contentSnapshot" IS NULL OR char_length("contentSnapshot") <= 8000),
  CONSTRAINT "SafetyReport_source_id_length" CHECK ("sourceId" IS NULL OR char_length("sourceId") <= 200),
  CONSTRAINT "SafetyReport_reporter_present" CHECK (num_nonnulls("reporterUserId", "reporterFingerprint") = 1),
  CONSTRAINT "SafetyReport_subject_shape" CHECK (
    ("subjectType" = 'COMMUNICATION_MESSAGE' AND "conversationId" IS NOT NULL AND "messageId" IS NOT NULL)
    OR ("subjectType" = 'COMMUNICATION_USER' AND "conversationId" IS NOT NULL)
    OR ("subjectType" = 'AI_OUTPUT' AND "sourceArea" IS NOT NULL AND "contentSnapshot" IS NOT NULL)
  )
);

CREATE INDEX "UserBlock_blockedUserId_idx"
  ON wewed_safety."UserBlock" ("blockedUserId", "createdAt" DESC);
CREATE INDEX "SafetyReport_status_created_idx"
  ON wewed_safety."SafetyReport" ("status", "createdAt" DESC);
CREATE INDEX "SafetyReport_reporter_created_idx"
  ON wewed_safety."SafetyReport" ("reporterUserId", "createdAt" DESC);
CREATE INDEX "SafetyReport_fingerprint_created_idx"
  ON wewed_safety."SafetyReport" ("reporterFingerprint", "createdAt" DESC)
  WHERE "reporterFingerprint" IS NOT NULL;
CREATE INDEX "SafetyReport_target_created_idx"
  ON wewed_safety."SafetyReport" ("targetUserId", "createdAt" DESC);
CREATE INDEX "SafetyReport_message_idx"
  ON wewed_safety."SafetyReport" ("messageId") WHERE "messageId" IS NOT NULL;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_safety FROM PUBLIC;
DO $wewed_safety_table_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_safety FROM %I', role_name);
    END IF;
  END LOOP;
END
$wewed_safety_table_roles$;
