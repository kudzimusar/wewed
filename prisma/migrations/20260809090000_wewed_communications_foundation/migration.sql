-- Wewed Communications & Collaboration foundation.
-- Canonical conversations are server-only and deliberately separate from the
-- public Wedding.Message guest-wall model.

CREATE SCHEMA IF NOT EXISTS wewed_communications;
REVOKE ALL ON SCHEMA wewed_communications FROM PUBLIC;

DO $wewed_communications_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_communications FROM %I', role_name);
    END IF;
  END LOOP;
END
$wewed_communications_roles$;

CREATE TABLE wewed_communications."CommunicationConversation" (
  "id" text PRIMARY KEY,
  "kind" text NOT NULL CHECK ("kind" IN ('DIRECT', 'GROUP')),
  "type" text NOT NULL CHECK ("type" IN ('DIRECT', 'WEDDING', 'PLANNER_CLIENT', 'MARKETPLACE', 'SUPPORT', 'INTERNAL', 'OPERATIONS', 'BILLING', 'SYSTEM')),
  "title" text,
  "weddingId" text,
  "createdByUserId" text NOT NULL,
  "status" text NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'ARCHIVED', 'CLOSED')),
  "lastMessageAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationConversation_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE SET NULL,
  CONSTRAINT "CommunicationConversation_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE RESTRICT
);

CREATE TABLE wewed_communications."CommunicationParticipant" (
  "id" text PRIMARY KEY,
  "conversationId" text NOT NULL,
  "userId" text NOT NULL,
  "role" text NOT NULL DEFAULT 'MEMBER' CHECK ("role" IN ('MEMBER', 'ADMIN')),
  "joinedAt" timestamptz NOT NULL DEFAULT now(),
  "leftAt" timestamptz,
  "lastReadAt" timestamptz,
  "archivedAt" timestamptz,
  "mutedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationParticipant_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES wewed_communications."CommunicationConversation"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationParticipant_conversation_user_key" UNIQUE ("conversationId", "userId")
);

CREATE TABLE wewed_communications."CommunicationMessage" (
  "id" text PRIMARY KEY,
  "conversationId" text NOT NULL,
  "senderUserId" text,
  "messageType" text NOT NULL DEFAULT 'USER' CHECK ("messageType" IN ('USER', 'SYSTEM', 'SUGGESTED', 'INTERNAL_NOTE')),
  "visibility" text NOT NULL DEFAULT 'PARTICIPANTS' CHECK ("visibility" IN ('PARTICIPANTS', 'STAFF_ONLY')),
  "body" text NOT NULL,
  "replyToMessageId" text,
  "editedAt" timestamptz,
  "deletedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES wewed_communications."CommunicationConversation"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationMessage_senderUserId_fkey"
    FOREIGN KEY ("senderUserId") REFERENCES public."User"("id") ON DELETE SET NULL,
  CONSTRAINT "CommunicationMessage_replyToMessageId_fkey"
    FOREIGN KEY ("replyToMessageId") REFERENCES wewed_communications."CommunicationMessage"("id") ON DELETE SET NULL,
  CONSTRAINT "CommunicationMessage_body_not_blank" CHECK (length(btrim("body")) > 0),
  CONSTRAINT "CommunicationMessage_body_length" CHECK (char_length("body") <= 4000)
);

CREATE TABLE wewed_communications."CommunicationEntityLink" (
  "id" text PRIMARY KEY,
  "conversationId" text NOT NULL,
  "entityType" text NOT NULL,
  "entityId" text NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationEntityLink_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES wewed_communications."CommunicationConversation"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationEntityLink_unique" UNIQUE ("conversationId", "entityType", "entityId")
);

CREATE TABLE wewed_communications."CommunicationDelivery" (
  "id" text PRIMARY KEY,
  "messageId" text NOT NULL,
  "recipientUserId" text NOT NULL,
  "channel" text NOT NULL CHECK ("channel" IN ('IN_APP', 'EMAIL', 'WHATSAPP', 'SMS', 'PUSH')),
  "status" text NOT NULL DEFAULT 'QUEUED' CHECK ("status" IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED')),
  "provider" text,
  "providerMessageId" text,
  "errorCode" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationDelivery_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES wewed_communications."CommunicationMessage"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationDelivery_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES public."User"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationDelivery_message_recipient_channel_key" UNIQUE ("messageId", "recipientUserId", "channel")
);

CREATE TABLE wewed_communications."CommunicationEvent" (
  "id" text PRIMARY KEY,
  "conversationId" text,
  "messageId" text,
  "actorUserId" text,
  "eventType" text NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationEvent_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES wewed_communications."CommunicationConversation"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationEvent_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES wewed_communications."CommunicationMessage"("id") ON DELETE SET NULL,
  CONSTRAINT "CommunicationEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES public."User"("id") ON DELETE SET NULL
);

CREATE INDEX "CommunicationConversation_lastMessageAt_idx"
  ON wewed_communications."CommunicationConversation" ("lastMessageAt" DESC NULLS LAST, "createdAt" DESC);
CREATE INDEX "CommunicationConversation_weddingId_type_idx"
  ON wewed_communications."CommunicationConversation" ("weddingId", "type", "status");
CREATE INDEX "CommunicationParticipant_userId_active_idx"
  ON wewed_communications."CommunicationParticipant" ("userId", "leftAt", "archivedAt");
CREATE INDEX "CommunicationParticipant_conversationId_idx"
  ON wewed_communications."CommunicationParticipant" ("conversationId", "leftAt");
CREATE INDEX "CommunicationMessage_conversation_created_idx"
  ON wewed_communications."CommunicationMessage" ("conversationId", "createdAt", "id");
CREATE INDEX "CommunicationMessage_sender_created_idx"
  ON wewed_communications."CommunicationMessage" ("senderUserId", "createdAt" DESC);
CREATE INDEX "CommunicationDelivery_recipient_status_idx"
  ON wewed_communications."CommunicationDelivery" ("recipientUserId", "status", "createdAt" DESC);
CREATE INDEX "CommunicationEvent_type_created_idx"
  ON wewed_communications."CommunicationEvent" ("eventType", "createdAt" DESC);
CREATE INDEX "CommunicationEvent_conversation_created_idx"
  ON wewed_communications."CommunicationEvent" ("conversationId", "createdAt" DESC);

-- Defense in depth: Supabase browser roles cannot query these tables directly even
-- if search_path changes. The application server's database owner/service role
-- remains responsible for all authorization.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_communications FROM PUBLIC;
DO $wewed_communications_table_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_communications FROM %I', role_name);
    END IF;
  END LOOP;
END
$wewed_communications_table_roles$;