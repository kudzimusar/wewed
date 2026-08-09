\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF to_regnamespace('wewed_communications') IS NULL THEN
    RAISE EXCEPTION 'wewed_communications schema is missing';
  END IF;

  IF to_regclass('public."Message"') IS NULL THEN
    RAISE EXCEPTION 'existing public wedding Message table is missing';
  END IF;

  IF to_regclass('wewed_communications."CommunicationConversation"') IS NULL OR
     to_regclass('wewed_communications."CommunicationParticipant"') IS NULL OR
     to_regclass('wewed_communications."CommunicationMessage"') IS NULL OR
     to_regclass('wewed_communications."CommunicationDelivery"') IS NULL OR
     to_regclass('wewed_communications."CommunicationEvent"') IS NULL THEN
    RAISE EXCEPTION 'one or more communications tables are missing';
  END IF;
END
$$;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      IF has_schema_privilege(role_name, 'wewed_communications', 'USAGE') THEN
        RAISE EXCEPTION '% unexpectedly has USAGE on wewed_communications', role_name;
      END IF;
      IF has_table_privilege(role_name, 'wewed_communications."CommunicationMessage"', 'SELECT') THEN
        RAISE EXCEPTION '% unexpectedly has SELECT on private communication messages', role_name;
      END IF;
    END IF;
  END LOOP;
END
$$;

INSERT INTO public."Couple"
  ("id", "slug", "partner1", "partner2", "createdAt", "updatedAt")
VALUES
  ('comm-couple', 'comm-couple-test', 'A', 'B', now(), now());

INSERT INTO public."Wedding"
  ("id", "slug", "title", "date", "venue", "venueCity", "venueCountry", "coupleId", "createdAt", "updatedAt")
VALUES
  ('comm-wedding', 'comm-wedding-test', 'Communications Test Wedding', now() + interval '30 days', 'Test Venue', 'Harare', 'Zimbabwe', 'comm-couple', now(), now());

INSERT INTO public."User"
  ("id", "email", "name", "role", "coupleId", "currentWeddingId", "isActive", "createdAt", "updatedAt")
VALUES
  ('comm-couple-user', 'comm-couple@example.test', 'Couple Test', 'couple', 'comm-couple', 'comm-wedding', true, now(), now()),
  ('comm-planner-user', 'comm-planner@example.test', 'Planner Test', 'planner', NULL, 'comm-wedding', true, now(), now()),
  ('comm-admin-user', 'comm-admin@example.test', 'Admin Test', 'admin', NULL, 'comm-wedding', true, now(), now());

INSERT INTO public."WeddingMembership"
  ("id", "userId", "weddingId", "role", "status", "createdAt", "updatedAt")
VALUES
  ('comm-membership', 'comm-planner-user', 'comm-wedding', 'planner', 'active', now(), now());

INSERT INTO wewed_communications."CommunicationConversation"
  ("id", "kind", "type", "title", "weddingId", "createdByUserId", "status", "createdAt", "updatedAt")
VALUES
  ('comm-conversation', 'DIRECT', 'PLANNER_CLIENT', 'Planner and couple', 'comm-wedding', 'comm-couple-user', 'OPEN', now(), now());

INSERT INTO wewed_communications."CommunicationParticipant"
  ("id", "conversationId", "userId", "role", "joinedAt", "createdAt", "updatedAt")
VALUES
  ('comm-participant-couple', 'comm-conversation', 'comm-couple-user', 'ADMIN', now(), now(), now()),
  ('comm-participant-planner', 'comm-conversation', 'comm-planner-user', 'MEMBER', now(), now(), now());

INSERT INTO wewed_communications."CommunicationMessage"
  ("id", "conversationId", "senderUserId", "messageType", "visibility", "body", "createdAt", "updatedAt")
VALUES
  ('comm-message', 'comm-conversation', 'comm-couple-user', 'USER', 'PARTICIPANTS', 'Hello planner', now(), now());

INSERT INTO wewed_communications."CommunicationDelivery"
  ("id", "messageId", "recipientUserId", "channel", "status", "provider", "createdAt", "updatedAt")
VALUES
  ('comm-delivery', 'comm-message', 'comm-planner-user', 'IN_APP', 'DELIVERED', 'wewed', now(), now());

INSERT INTO wewed_communications."CommunicationEvent"
  ("id", "conversationId", "messageId", "actorUserId", "eventType", "metadata", "createdAt")
VALUES
  ('comm-event', 'comm-conversation', 'comm-message', 'comm-couple-user', 'message_sent', '{"bodyLength":13,"recipientCount":1}'::jsonb, now());

INSERT INTO public."Message"
  ("id", "type", "content", "authorName", "isPublic", "weddingId", "createdAt", "updatedAt")
VALUES
  ('comm-public-message', 'guestbook', 'Public guest-wall test', 'Guest', true, 'comm-wedding', now(), now());

DO $$
DECLARE
  participant_count integer;
  communication_message_count integer;
  public_message_count integer;
  event_has_body boolean;
BEGIN
  SELECT count(*) INTO participant_count
  FROM wewed_communications."CommunicationParticipant"
  WHERE "conversationId" = 'comm-conversation';
  IF participant_count <> 2 THEN
    RAISE EXCEPTION 'expected 2 private communication participants, got %', participant_count;
  END IF;

  SELECT count(*) INTO communication_message_count
  FROM wewed_communications."CommunicationMessage"
  WHERE "conversationId" = 'comm-conversation';
  IF communication_message_count <> 1 THEN
    RAISE EXCEPTION 'expected 1 private communication message, got %', communication_message_count;
  END IF;

  SELECT count(*) INTO public_message_count
  FROM public."Message"
  WHERE "id" = 'comm-public-message';
  IF public_message_count <> 1 THEN
    RAISE EXCEPTION 'public wedding Message regression contract failed';
  END IF;

  SELECT ("metadata" ? 'body') INTO event_has_body
  FROM wewed_communications."CommunicationEvent"
  WHERE "id" = 'comm-event';
  IF event_has_body THEN
    RAISE EXCEPTION 'analytics event unexpectedly contains raw message body';
  END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_communications."CommunicationParticipant"
      ("id", "conversationId", "userId", "role", "joinedAt", "createdAt", "updatedAt")
    VALUES
      ('comm-participant-duplicate', 'comm-conversation', 'comm-planner-user', 'MEMBER', now(), now(), now());
    RAISE EXCEPTION 'duplicate participant uniqueness constraint did not fire';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO wewed_communications."CommunicationMessage"
      ("id", "conversationId", "senderUserId", "messageType", "visibility", "body", "createdAt", "updatedAt")
    VALUES
      ('comm-message-blank', 'comm-conversation', 'comm-couple-user', 'USER', 'PARTICIPANTS', '   ', now(), now());
    RAISE EXCEPTION 'blank message constraint did not fire';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO wewed_communications."CommunicationMessage"
      ("id", "conversationId", "senderUserId", "messageType", "visibility", "body", "createdAt", "updatedAt")
    VALUES
      ('comm-message-long', 'comm-conversation', 'comm-couple-user', 'USER', 'PARTICIPANTS', repeat('x', 4001), now(), now());
    RAISE EXCEPTION 'message length constraint did not fire';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;
END
$$;

ROLLBACK;

\echo 'Wewed communications PostgreSQL integration contract: PASS'