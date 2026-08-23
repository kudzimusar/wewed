-- Extend confirmed booking operations to the full booking logistics timeline.

ALTER TABLE wewed_booking."BookingTaskLink"
  DROP CONSTRAINT "BookingTaskLink_kind_check";
ALTER TABLE wewed_booking."BookingTaskLink"
  ADD CONSTRAINT "BookingTaskLink_kind_check"
    CHECK ("kind" IN ('service','pickup','delivery','setup','collection','return'));

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
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  IF OLD.status='confirmed' THEN RETURN NEW; END IF;

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
    COALESCE(NEW."serviceStart"::timestamp,NEW."appointmentAt"::timestamp,NEW."eventDate"::timestamp,NEW."pickupAt"::timestamp,NEW."deliveryAt"::timestamp)
  );

  IF NEW."pickupAt" IS NOT NULL THEN
    PERFORM wewed_booking.upsert_booking_task(
      NEW.id,NEW."weddingId",'pickup',
      'Pickup / handover: ' || provider_name || ' — ' || service_label,
      base_description || ' Confirm handover condition, quantities and evidence.',
      NEW."pickupAt"::timestamp
    );
  END IF;

  IF NEW."deliveryAt" IS NOT NULL THEN
    PERFORM wewed_booking.upsert_booking_task(
      NEW.id,NEW."weddingId",'delivery',
      'Delivery: ' || provider_name || ' — ' || service_label,
      base_description || ' Confirm venue access, delivered quantities and handover evidence.',
      NEW."deliveryAt"::timestamp
    );
  END IF;

  IF NEW."setupStart" IS NOT NULL THEN
    PERFORM wewed_booking.upsert_booking_task(
      NEW.id,NEW."weddingId",'setup',
      'Setup: ' || provider_name || ' — ' || service_label,
      base_description || CASE WHEN NEW."setupEnd" IS NOT NULL THEN ' Setup window ends ' || NEW."setupEnd"::text || '.' ELSE ' Confirm setup completion before service.' END,
      NEW."setupStart"::timestamp
    );
  END IF;

  IF NEW."collectionAt" IS NOT NULL THEN
    PERFORM wewed_booking.upsert_booking_task(
      NEW.id,NEW."weddingId",'collection',
      'Collection: ' || provider_name || ' — ' || service_label,
      base_description || ' Confirm collection quantities, condition and venue handover.',
      NEW."collectionAt"::timestamp
    );
  END IF;

  IF NEW."returnDueAt" IS NOT NULL THEN
    PERFORM wewed_booking.upsert_booking_task(
      NEW.id,NEW."weddingId",'return',
      'Return: ' || provider_name || ' — ' || service_label,
      base_description || ' Complete return, inspection and any damage evidence before closing the booking.',
      NEW."returnDueAt"::timestamp
    );
  END IF;

  RETURN NEW;
END;
$$;
