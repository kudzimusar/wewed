-- Booking operations convergence.
-- Calendar already projects ServiceEngagement.serviceDate and PlannerTask.dueDate, so confirmed
-- bookings create deterministic PlannerTask records rather than a parallel calendar ledger.
-- Status notifications are deduplicated by recipient + booking + state.

CREATE TABLE wewed_booking."BookingTaskLink" (
  "id" text PRIMARY KEY,
  "bookingId" text NOT NULL,
  "plannerTaskId" text NOT NULL,
  "kind" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingTaskLink_booking_fkey" FOREIGN KEY ("bookingId") REFERENCES wewed_booking."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingTaskLink_task_fkey" FOREIGN KEY ("plannerTaskId") REFERENCES public."PlannerTask"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookingTaskLink_booking_kind_key" UNIQUE ("bookingId","kind"),
  CONSTRAINT "BookingTaskLink_task_key" UNIQUE ("plannerTaskId"),
  CONSTRAINT "BookingTaskLink_kind_check" CHECK ("kind" IN ('service','pickup','return'))
);

CREATE OR REPLACE FUNCTION wewed_booking.upsert_booking_task(
  booking_id text,
  wedding_id text,
  task_kind text,
  task_title text,
  task_description text,
  task_due timestamp without time zone
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, wewed_booking
AS $$
DECLARE
  task_id text;
  planner_user_id text;
  planner_name text;
BEGIN
  task_id := 'booking-task-' || md5(booking_id || ':' || task_kind);

  SELECT wm."userId", u.name
    INTO planner_user_id, planner_name
  FROM public."WeddingMembership" wm
  LEFT JOIN public."User" u ON u.id=wm."userId"
  WHERE wm."weddingId"=wedding_id AND wm.status='active' AND wm.role='planner'
  ORDER BY wm."createdAt"
  LIMIT 1;

  INSERT INTO public."PlannerTask"
    (id,title,description,category,status,priority,"dueDate",assignee,"assigneeUserId","order","weddingId","createdAt","updatedAt")
  VALUES
    (task_id,task_title,task_description,'vendor','todo','high',task_due,planner_name,planner_user_id,0,wedding_id,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO UPDATE SET
    title=EXCLUDED.title,
    description=EXCLUDED.description,
    "dueDate"=EXCLUDED."dueDate",
    assignee=COALESCE(public."PlannerTask".assignee,EXCLUDED.assignee),
    "assigneeUserId"=COALESCE(public."PlannerTask"."assigneeUserId",EXCLUDED."assigneeUserId"),
    "updatedAt"=CURRENT_TIMESTAMP;

  INSERT INTO wewed_booking."BookingTaskLink" (id,"bookingId","plannerTaskId",kind)
  VALUES ('booking-task-link-' || md5(booking_id || ':' || task_kind),booking_id,task_id,task_kind)
  ON CONFLICT ("bookingId",kind) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION wewed_booking.sync_confirmed_booking_operations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, wewed_admin, wewed_booking
AS $$
DECLARE
  provider_name text;
  service_label text;
  base_description text;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status='confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT p."displayName",
         COALESCE((SELECT l."nameSnapshot" FROM wewed_booking."BookingLine" l WHERE l."bookingId"=NEW.id ORDER BY l."createdAt" LIMIT 1),o."displayName")
    INTO provider_name, service_label
  FROM wewed_admin."ProviderProfile" p
  JOIN wewed_admin."ProviderServiceOffering" o ON o.id=NEW."offeringId"
  WHERE p."businessAccountId"=NEW."businessAccountId"
  LIMIT 1;

  provider_name := COALESCE(provider_name,'Wedding provider');
  service_label := COALESCE(service_label,'Booked service');
  base_description := 'Booking ' || NEW."publicReference" || ' · ' || provider_name || ' · ' || service_label || '. Source: Wewed Booking Engine.';

  PERFORM wewed_booking.upsert_booking_task(
    NEW.id,NEW."weddingId",'service',
    'Coordinate booking: ' || provider_name || ' — ' || service_label,
    base_description,
    COALESCE(NEW."serviceStart"::timestamp,NEW."appointmentAt"::timestamp,NEW."eventDate"::timestamp,NEW."pickupAt"::timestamp)
  );

  IF NEW."pickupAt" IS NOT NULL THEN
    PERFORM wewed_booking.upsert_booking_task(
      NEW.id,NEW."weddingId",'pickup',
      'Pickup / handover: ' || provider_name || ' — ' || service_label,
      base_description || ' Confirm handover condition, quantities and evidence.',
      NEW."pickupAt"::timestamp
    );
  END IF;

  IF NEW."returnDueAt" IS NOT NULL THEN
    PERFORM wewed_booking.upsert_booking_task(
      NEW.id,NEW."weddingId",'return',
      'Return / collection: ' || provider_name || ' — ' || service_label,
      base_description || ' Complete return, inspection and any damage evidence before closing the booking.',
      NEW."returnDueAt"::timestamp
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Booking_confirmed_operations"
AFTER UPDATE OF status ON wewed_booking."Booking"
FOR EACH ROW
WHEN (NEW.status='confirmed' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION wewed_booking.sync_confirmed_booking_operations();

CREATE OR REPLACE FUNCTION wewed_booking.insert_booking_notification(
  recipient_user_id text,
  booking_id text,
  wedding_id text,
  event_state text,
  notification_category text,
  notification_severity text,
  notification_title text,
  notification_body text,
  deep_link text,
  requires_action boolean
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, wewed_booking
AS $$
BEGIN
  IF recipient_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public."Notification"
    (id,"recipientUserId","weddingId","actorUserId","sourceType","sourceId","eventType",category,severity,title,body,metadata,"deepLink","actionType","requiresAction",state,"dedupeKey","createdAt","updatedAt")
  VALUES
    ('booking-notification-' || md5(recipient_user_id || ':' || booking_id || ':' || event_state),
     recipient_user_id,wedding_id,NULL,'booking',booking_id,'booking.' || event_state,
     notification_category,notification_severity,notification_title,notification_body,
     jsonb_build_object('bookingId',booking_id,'bookingStatus',event_state),deep_link,'open_booking',requires_action,'active',
     'booking:' || booking_id || ':' || event_state,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  ON CONFLICT ("recipientUserId","dedupeKey") WHERE "dedupeKey" IS NOT NULL DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION wewed_booking.notify_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, wewed_admin, wewed_booking
AS $$
DECLARE
  provider_user_id text;
  planner_user_id text;
  provider_name text;
  title_text text;
  body_text text;
  category_text text := 'vendor';
  severity_text text := 'normal';
  action_required boolean := false;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT COALESCE(ba."ownerUserId",(
           SELECT bam."userId" FROM wewed_admin."BusinessAccountMember" bam
           WHERE bam."businessAccountId"=NEW."businessAccountId" AND bam.status='active'
           ORDER BY CASE WHEN bam.role='business_owner' THEN 0 ELSE 1 END,bam."createdAt" LIMIT 1
         )),ba.name
    INTO provider_user_id,provider_name
  FROM wewed_admin."BusinessAccount" ba WHERE ba.id=NEW."businessAccountId";

  SELECT wm."userId" INTO planner_user_id
  FROM public."WeddingMembership" wm
  WHERE wm."weddingId"=NEW."weddingId" AND wm.status='active' AND wm.role='planner'
  ORDER BY wm."createdAt" LIMIT 1;

  IF NEW.status IN ('requested','quote_requested') THEN
    title_text := CASE WHEN NEW.status='quote_requested' THEN 'New quote request' ELSE 'New booking request' END;
    body_text := 'Wedding booking ' || NEW."publicReference" || ' is waiting for ' || COALESCE(provider_name,'the vendor') || ' to respond.';
    severity_text := 'action_required'; action_required := true;
    PERFORM wewed_booking.insert_booking_notification(provider_user_id,NEW.id,NEW."weddingId",NEW.status,'vendor',severity_text,title_text,body_text,'/vendor/bookings',true);
  ELSIF NEW.status='quote_proposed' THEN
    title_text := 'Vendor quote ready';
    body_text := COALESCE(provider_name,'Your vendor') || ' submitted a quote for booking ' || NEW."publicReference" || '. Review it before accepting.';
    severity_text := 'action_required'; action_required := true;
    PERFORM wewed_booking.insert_booking_notification(NEW."customerUserId",NEW.id,NEW."weddingId",NEW.status,'vendor',severity_text,title_text,body_text,'/planner/bookings',true);
    IF planner_user_id IS DISTINCT FROM NEW."customerUserId" THEN
      PERFORM wewed_booking.insert_booking_notification(planner_user_id,NEW.id,NEW."weddingId",NEW.status,'vendor',severity_text,title_text,body_text,'/planner/bookings',true);
    END IF;
  ELSIF NEW.status='awaiting_terms' THEN
    category_text := 'contract'; severity_text := 'action_required'; action_required := true;
    title_text := 'Contract acceptance required';
    body_text := 'Booking ' || NEW."publicReference" || ' has agreed commercial terms but is not confirmed until the governed Wewed contract becomes effective.';
    PERFORM wewed_booking.insert_booking_notification(NEW."customerUserId",NEW.id,NEW."weddingId",NEW.status,category_text,severity_text,title_text,body_text,'/planner/bookings',true);
    PERFORM wewed_booking.insert_booking_notification(provider_user_id,NEW.id,NEW."weddingId",NEW.status,category_text,severity_text,title_text,body_text,'/vendor/bookings',true);
    IF planner_user_id IS DISTINCT FROM NEW."customerUserId" THEN
      PERFORM wewed_booking.insert_booking_notification(planner_user_id,NEW.id,NEW."weddingId",NEW.status,category_text,severity_text,title_text,body_text,'/planner/bookings',true);
    END IF;
  ELSIF NEW.status='confirmed' THEN
    title_text := 'Booking confirmed';
    body_text := 'Booking ' || NEW."publicReference" || ' is confirmed. Operational tasks and calendar records are now linked to the wedding.';
    severity_text := 'important';
    PERFORM wewed_booking.insert_booking_notification(NEW."customerUserId",NEW.id,NEW."weddingId",NEW.status,'vendor',severity_text,title_text,body_text,'/planner/bookings',false);
    PERFORM wewed_booking.insert_booking_notification(provider_user_id,NEW.id,NEW."weddingId",NEW.status,'vendor',severity_text,title_text,body_text,'/vendor/bookings',false);
    IF planner_user_id IS DISTINCT FROM NEW."customerUserId" THEN
      PERFORM wewed_booking.insert_booking_notification(planner_user_id,NEW.id,NEW."weddingId",NEW.status,'vendor',severity_text,title_text,body_text,'/planner/bookings',false);
    END IF;
  ELSIF NEW.status='declined' THEN
    title_text := 'Booking declined';
    body_text := COALESCE(provider_name,'The vendor') || ' declined booking ' || NEW."publicReference" || '. No payment or couple-funded spend has been recorded.';
    severity_text := 'important';
    PERFORM wewed_booking.insert_booking_notification(NEW."customerUserId",NEW.id,NEW."weddingId",NEW.status,'vendor',severity_text,title_text,body_text,'/planner/bookings',false);
    IF planner_user_id IS DISTINCT FROM NEW."customerUserId" THEN
      PERFORM wewed_booking.insert_booking_notification(planner_user_id,NEW.id,NEW."weddingId",NEW.status,'vendor',severity_text,title_text,body_text,'/planner/bookings',false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Booking_status_notifications"
AFTER UPDATE OF status ON wewed_booking."Booking"
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION wewed_booking.notify_booking_status();

REVOKE ALL ON wewed_booking."BookingTaskLink" FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.upsert_booking_task(text,text,text,text,text,timestamp without time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.sync_confirmed_booking_operations() FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.insert_booking_notification(text,text,text,text,text,text,text,text,text,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_booking.notify_booking_status() FROM PUBLIC;

DO $booking_ops_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON wewed_booking."BookingTaskLink" FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.upsert_booking_task(text,text,text,text,text,timestamp without time zone) FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.sync_confirmed_booking_operations() FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.insert_booking_notification(text,text,text,text,text,text,text,text,text,text,boolean) FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_booking.notify_booking_status() FROM %I',role_name);
    END IF;
  END LOOP;
END
$booking_ops_roles$;
