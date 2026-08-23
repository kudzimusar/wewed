-- Message Push uses the same canonical per-device subscriptions as notification Push.
-- One auditable CommunicationDelivery is queued per message/recipient/channel; the
-- application dispatcher fans that delivery out to every currently active device.

CREATE OR REPLACE FUNCTION wewed_communications.queue_external_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'wewed_communications'
AS $function$
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

  -- Address-based channels remain tied to a verified CommunicationEndpoint.
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
    AND endpoint."channel" IN ('EMAIL', 'WHATSAPP', 'SMS')
    AND endpoint."status" = 'VERIFIED'
  ON CONFLICT ("messageId", "recipientUserId", "channel") DO NOTHING;

  -- Push is device-backed. It deliberately has no CommunicationEndpoint foreign
  -- key; the dispatcher resolves all active PushSubscription rows at send time.
  INSERT INTO wewed_communications."CommunicationDelivery"
    ("id", "messageId", "recipientUserId", "channel", "status", "endpointId", "nextAttemptAt", "metadata")
  SELECT
    gen_random_uuid()::text,
    NEW."messageId",
    NEW."recipientUserId",
    'PUSH',
    'QUEUED',
    NULL,
    now(),
    jsonb_build_object('queuedBy', 'wewed', 'subscriptionSource', 'PushSubscription')
  WHERE EXISTS (
    SELECT 1
    FROM wewed_communications."CommunicationPreference" preference
    WHERE preference."userId" = NEW."recipientUserId"
      AND preference."channel" = 'PUSH'
      AND preference."enabled" = true
  )
  AND EXISTS (
    SELECT 1
    FROM public."PushSubscription" subscription
    WHERE subscription."userId" = NEW."recipientUserId"
      AND subscription."disabledAt" IS NULL
      AND (
        subscription."expirationTime" IS NULL
        OR subscription."expirationTime" > (EXTRACT(EPOCH FROM now()) * 1000)::bigint
      )
  )
  ON CONFLICT ("messageId", "recipientUserId", "channel") DO NOTHING;

  RETURN NEW;
END
$function$;
