-- Booking-scoped communications use Wewed's existing communications store.
-- No parallel booking message table is introduced.

CREATE OR REPLACE FUNCTION wewed_booking.ensure_booking_communication_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, wewed_admin, wewed_booking, wewed_communications
AS $$
DECLARE
  conversation_id text;
  provider_user_id text;
  planner_user_id text;
  provider_name text;
  participant_count integer := 0;
BEGIN
  IF NEW.status NOT IN ('requested','quote_requested','quote_proposed','awaiting_vendor','awaiting_terms','awaiting_deposit','confirmed') THEN
    RETURN NEW;
  END IF;

  conversation_id := 'booking-conversation-' || md5(NEW.id);

  SELECT COALESCE(ba."ownerUserId",(
           SELECT bam."userId"
           FROM wewed_admin."BusinessAccountMember" bam
           WHERE bam."businessAccountId"=NEW."businessAccountId" AND bam.status='active'
           ORDER BY CASE WHEN bam.role='business_owner' THEN 0 ELSE 1 END,bam."createdAt"
           LIMIT 1
         )),ba.name
    INTO provider_user_id,provider_name
  FROM wewed_admin."BusinessAccount" ba
  WHERE ba.id=NEW."businessAccountId";

  SELECT wm."userId" INTO planner_user_id
  FROM public."WeddingMembership" wm
  WHERE wm."weddingId"=NEW."weddingId" AND wm.status='active' AND wm.role='planner'
  ORDER BY wm."createdAt"
  LIMIT 1;

  INSERT INTO wewed_communications."CommunicationConversation"
    (id,kind,type,title,"weddingId","createdByUserId",status,"createdAt","updatedAt")
  VALUES
    (conversation_id,
     CASE WHEN planner_user_id IS NOT NULL AND planner_user_id IS DISTINCT FROM NEW."customerUserId" THEN 'GROUP' ELSE 'DIRECT' END,
     'MARKETPLACE',
     'Booking ' || NEW."publicReference" || ' · ' || COALESCE(provider_name,'Wedding provider'),
     NEW."weddingId",NEW."createdByUserId",'OPEN',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO wewed_communications."CommunicationParticipant"
    (id,"conversationId","userId",role,"joinedAt","createdAt","updatedAt")
  VALUES
    ('booking-participant-' || md5(conversation_id || ':' || NEW."customerUserId"),conversation_id,NEW."customerUserId",'MEMBER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  ON CONFLICT ("conversationId","userId") DO NOTHING;
  participant_count := participant_count + 1;

  IF provider_user_id IS NOT NULL AND provider_user_id IS DISTINCT FROM NEW."customerUserId" THEN
    INSERT INTO wewed_communications."CommunicationParticipant"
      (id,"conversationId","userId",role,"joinedAt","createdAt","updatedAt")
    VALUES
      ('booking-participant-' || md5(conversation_id || ':' || provider_user_id),conversation_id,provider_user_id,'MEMBER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("conversationId","userId") DO NOTHING;
    participant_count := participant_count + 1;
  END IF;

  IF planner_user_id IS NOT NULL
     AND planner_user_id IS DISTINCT FROM NEW."customerUserId"
     AND planner_user_id IS DISTINCT FROM provider_user_id THEN
    INSERT INTO wewed_communications."CommunicationParticipant"
      (id,"conversationId","userId",role,"joinedAt","createdAt","updatedAt")
    VALUES
      ('booking-participant-' || md5(conversation_id || ':' || planner_user_id),conversation_id,planner_user_id,'MEMBER',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("conversationId","userId") DO NOTHING;
    participant_count := participant_count + 1;
  END IF;

  INSERT INTO wewed_communications."CommunicationEntityLink"
    (id,"conversationId","entityType","entityId",metadata,"createdAt")
  VALUES
    ('booking-entity-' || md5(conversation_id || ':booking:' || NEW.id),conversation_id,'booking',NEW.id,
     jsonb_build_object('publicReference',NEW."publicReference",'bookingStatus',NEW.status),CURRENT_TIMESTAMP)
  ON CONFLICT ("conversationId","entityType","entityId") DO NOTHING;

  INSERT INTO wewed_communications."CommunicationEntityLink"
    (id,"conversationId","entityType","entityId",metadata,"createdAt")
  VALUES
    ('booking-entity-' || md5(conversation_id || ':wedding:' || NEW."weddingId"),conversation_id,'wedding',NEW."weddingId",'{}'::jsonb,CURRENT_TIMESTAMP)
  ON CONFLICT ("conversationId","entityType","entityId") DO NOTHING;

  IF NEW."serviceEngagementId" IS NOT NULL THEN
    INSERT INTO wewed_communications."CommunicationEntityLink"
      (id,"conversationId","entityType","entityId",metadata,"createdAt")
    VALUES
      ('booking-entity-' || md5(conversation_id || ':engagement:' || NEW."serviceEngagementId"),conversation_id,'service_engagement',NEW."serviceEngagementId",'{}'::jsonb,CURRENT_TIMESTAMP)
    ON CONFLICT ("conversationId","entityType","entityId") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Booking_communications_context"
AFTER UPDATE OF status ON wewed_booking."Booking"
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION wewed_booking.ensure_booking_communication_context();

REVOKE ALL ON FUNCTION wewed_booking.ensure_booking_communication_context() FROM PUBLIC;
DO $booking_communications_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.ensure_booking_communication_context() FROM %I',role_name);
    END IF;
  END LOOP;
END
$booking_communications_roles$;
