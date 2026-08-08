CREATE SCHEMA IF NOT EXISTS wewed_admin;

CREATE TABLE IF NOT EXISTS wewed_admin."EmailDelivery" (
  "id" TEXT PRIMARY KEY,
  "internalKey" TEXT NOT NULL UNIQUE,
  "provider" TEXT NOT NULL DEFAULT 'resend',
  "providerEmailId" TEXT UNIQUE,
  "category" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "sender" TEXT,
  "replyTo" TEXT,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "failureReason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "sentAt" TIMESTAMPTZ,
  "deliveredAt" TIMESTAMPTZ,
  "delayedAt" TIMESTAMPTZ,
  "bouncedAt" TIMESTAMPTZ,
  "complainedAt" TIMESTAMPTZ,
  "failedAt" TIMESTAMPTZ,
  "lastEventAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wewed_admin."EmailWebhookEvent" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL DEFAULT 'resend',
  "eventType" TEXT NOT NULL,
  "providerEmailId" TEXT,
  "deliveryId" TEXT REFERENCES wewed_admin."EmailDelivery"("id") ON DELETE SET NULL,
  "payload" JSONB NOT NULL,
  "eventCreatedAt" TIMESTAMPTZ,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EmailDelivery_recipient_status_idx"
  ON wewed_admin."EmailDelivery" ("recipient", "status");
CREATE INDEX IF NOT EXISTS "EmailDelivery_category_createdAt_idx"
  ON wewed_admin."EmailDelivery" ("category", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EmailWebhookEvent_providerEmailId_idx"
  ON wewed_admin."EmailWebhookEvent" ("providerEmailId");
CREATE INDEX IF NOT EXISTS "EmailWebhookEvent_eventType_receivedAt_idx"
  ON wewed_admin."EmailWebhookEvent" ("eventType", "receivedAt" DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE wewed_admin."EmailDelivery" FROM anon;
    REVOKE ALL ON TABLE wewed_admin."EmailWebhookEvent" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE wewed_admin."EmailDelivery" FROM authenticated;
    REVOKE ALL ON TABLE wewed_admin."EmailWebhookEvent" FROM authenticated;
  END IF;
END
$$;
