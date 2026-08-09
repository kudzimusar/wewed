-- Wewed multi-channel communication readiness.
-- External endpoints/preferences and durable provider delivery state remain in the
-- private communications schema. No provider API is called from this migration.

CREATE TABLE wewed_communications."CommunicationEndpoint" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "channel" text NOT NULL CHECK ("channel" IN ('EMAIL', 'WHATSAPP', 'SMS', 'PUSH')),
  "address" text NOT NULL,
  "normalizedAddress" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'VERIFIED', 'DISABLED', 'BOUNCED')),
  "verifiedAt" timestamptz,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationEndpoint_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationEndpoint_user_channel_address_key"
    UNIQUE ("userId", "channel", "normalizedAddress")
);

CREATE UNIQUE INDEX "CommunicationEndpoint_one_verified_channel_idx"
  ON wewed_communications."CommunicationEndpoint" ("userId", "channel")
  WHERE "status" = 'VERIFIED';
CREATE INDEX "CommunicationEndpoint_user_channel_status_idx"
  ON wewed_communications."CommunicationEndpoint" ("userId", "channel", "status");

CREATE TABLE wewed_communications."CommunicationPreference" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "channel" text NOT NULL CHECK ("channel" IN ('EMAIL', 'WHATSAPP', 'SMS', 'PUSH')),
  "enabled" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationPreference_user_channel_key" UNIQUE ("userId", "channel")
);

ALTER TABLE wewed_communications."CommunicationDelivery"
  ADD COLUMN "endpointId" text,
  ADD COLUMN "attemptCount" integer NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" integer NOT NULL DEFAULT 5,
  ADD COLUMN "lastAttemptAt" timestamptz,
  ADD COLUMN "nextAttemptAt" timestamptz,
  ADD COLUMN "sentAt" timestamptz,
  ADD COLUMN "deliveredAt" timestamptz,
  ADD COLUMN "failedAt" timestamptz,
  ADD COLUMN "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT "CommunicationDelivery_endpointId_fkey"
    FOREIGN KEY ("endpointId") REFERENCES wewed_communications."CommunicationEndpoint"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "CommunicationDelivery_attemptCount_check" CHECK ("attemptCount" >= 0),
  ADD CONSTRAINT "CommunicationDelivery_maxAttempts_check" CHECK ("maxAttempts" BETWEEN 1 AND 20);

ALTER TABLE wewed_communications."CommunicationDelivery"
  DROP CONSTRAINT "CommunicationDelivery_status_check";
ALTER TABLE wewed_communications."CommunicationDelivery"
  ADD CONSTRAINT "CommunicationDelivery_status_check"
    CHECK ("status" IN ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED'));

UPDATE wewed_communications."CommunicationDelivery"
SET "deliveredAt" = COALESCE("deliveredAt", "updatedAt")
WHERE "status" = 'DELIVERED';

CREATE INDEX "CommunicationDelivery_queue_idx"
  ON wewed_communications."CommunicationDelivery" ("status", "nextAttemptAt", "createdAt")
  WHERE "status" = 'QUEUED';
CREATE INDEX "CommunicationDelivery_provider_message_idx"
  ON wewed_communications."CommunicationDelivery" ("provider", "providerMessageId")
  WHERE "providerMessageId" IS NOT NULL;

CREATE TABLE wewed_communications."CommunicationProviderEvent" (
  "id" text PRIMARY KEY,
  "provider" text NOT NULL,
  "channel" text NOT NULL CHECK ("channel" IN ('EMAIL', 'WHATSAPP', 'SMS', 'PUSH')),
  "providerEventId" text NOT NULL,
  "direction" text NOT NULL CHECK ("direction" IN ('STATUS', 'INBOUND')),
  "eventType" text NOT NULL,
  "status" text NOT NULL DEFAULT 'RECEIVED' CHECK ("status" IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED')),
  "deliveryId" text,
  "messageId" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "processedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationProviderEvent_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES wewed_communications."CommunicationDelivery"("id") ON DELETE SET NULL,
  CONSTRAINT "CommunicationProviderEvent_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES wewed_communications."CommunicationMessage"("id") ON DELETE SET NULL,
  CONSTRAINT "CommunicationProviderEvent_provider_event_key" UNIQUE ("provider", "providerEventId")
);

CREATE INDEX "CommunicationProviderEvent_status_created_idx"
  ON wewed_communications."CommunicationProviderEvent" ("status", "createdAt");

-- Queue external channels in the same canonical transaction that creates the
-- IN_APP delivery. A VERIFIED endpoint plus explicit enabled preference is
-- required. STAFF_ONLY notes are never fanned out to non-admin users.
CREATE FUNCTION wewed_communications."queue_external_deliveries"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, wewed_communications
AS $$
DECLARE
  message_visibility text;
  recipient_role text;
BEGIN
  IF NEW."channel" <> 'IN_APP' OR NEW."status" <> 'DELIVERED' THEN
    RETURN NEW;
  END IF;

  SELECT m."visibility", u."role"
  INTO message_visibility, recipient_role
  FROM wewed_communications."CommunicationMessage" m
  JOIN public."User" u ON u."id" = NEW."recipientUserId"
  WHERE m."id" = NEW."messageId";

  IF message_visibility = 'STAFF_ONLY' AND recipient_role <> 'admin' THEN
    RETURN NEW;
  END IF;

  INSERT INTO wewed_communications."CommunicationDelivery"
    ("id", "messageId", "recipientUserId", "channel", "status", "endpointId", "nextAttemptAt", "metadata")
  SELECT
    gen_random_uuid()::text,
    NEW."messageId",
    NEW."recipientUserId",
    endpoint."channel",
    'QUEUED',
    endpoint."id",
    now(),
    jsonb_build_object('queuedBy', 'wewed')
  FROM wewed_communications."CommunicationEndpoint" endpoint
  JOIN wewed_communications."CommunicationPreference" preference
    ON preference."userId" = endpoint."userId"
   AND preference."channel" = endpoint."channel"
   AND preference."enabled" = true
  WHERE endpoint."userId" = NEW."recipientUserId"
    AND endpoint."status" = 'VERIFIED'
  ON CONFLICT ("messageId", "recipientUserId", "channel") DO NOTHING;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION wewed_communications."queue_external_deliveries"() FROM PUBLIC;

CREATE TRIGGER "queue_external_deliveries_trigger"
AFTER INSERT ON wewed_communications."CommunicationDelivery"
FOR EACH ROW
EXECUTE FUNCTION wewed_communications."queue_external_deliveries"();

-- Defense in depth for all newly added private data.
REVOKE ALL PRIVILEGES ON TABLE wewed_communications."CommunicationEndpoint" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE wewed_communications."CommunicationPreference" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE wewed_communications."CommunicationProviderEvent" FROM PUBLIC;
DO $wewed_channel_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE wewed_communications."CommunicationEndpoint" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE wewed_communications."CommunicationPreference" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE wewed_communications."CommunicationProviderEvent" FROM %I', role_name);
    END IF;
  END LOOP;
END
$wewed_channel_roles$;