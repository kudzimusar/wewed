\set ON_ERROR_STOP on

-- Seed isolated booking-domain rows without manufacturing unrelated public/provider records.
-- Foreign-key triggers are disabled only for fixture construction; every assertion runs with normal triggers enabled.
BEGIN;
SET LOCAL session_replication_role = replica;
INSERT INTO wewed_booking."ProviderCatalogItem"
  (id,"offeringId",slug,name,"bookingArchetype","bookingMode",status,"basePriceCents",currency,"holdMinutes")
VALUES ('ci-sql-item','ci-sql-offering','ci-sql-item','CI SQL item','individual_rental','instant','published',10000,'USD',15);
INSERT INTO wewed_booking."Booking"
  (id,"publicReference","businessAccountId","offeringId","weddingId","customerUserId","createdByUserId","bookingMode",status,currency,"depositCents","totalCents","serviceEngagementId")
VALUES ('ci-sql-booking','WW-CI-SQL-BOOKING','ci-business','ci-sql-offering','ci-wedding','ci-user','ci-user','instant','awaiting_deposit','USD',5000,10000,'ci-engagement');
INSERT INTO wewed_booking."BookingLine"
  (id,"bookingId","catalogItemId","nameSnapshot",quantity,"selectedOptions")
VALUES ('ci-sql-line','ci-sql-booking','ci-sql-item','CI SQL item',1,'{"addOns":[]}'::jsonb);
INSERT INTO wewed_booking."BookingEvent"
  (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
VALUES ('ci-sql-event','ci-sql-booking','ci-user','ci.seed','draft','awaiting_deposit','{}'::jsonb);
INSERT INTO wewed_booking."BookingAmendment"
  (id,"bookingId",status,"requestedByUserId",summary,"beforeSnapshot","afterSnapshot","impactSnapshot")
VALUES ('ci-sql-amendment','ci-sql-booking','proposed','ci-user','Change date','{}'::jsonb,'{}'::jsonb,'{}'::jsonb);
COMMIT;

DO $$
BEGIN
  BEGIN
    UPDATE wewed_booking."Booking" SET status='confirmed' WHERE id='ci-sql-booking';
    RAISE EXCEPTION 'deposit guard failed: booking confirmed without factual deposit evidence';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%booking_deposit_not_satisfied%' THEN RAISE; END IF;
  END;
END $$;

-- A refund removes paid value. Reversing that refund restores it; reversals take the opposite
-- economic sign of the fact they reference rather than always subtracting.
BEGIN;
SET LOCAL session_replication_role = replica;
INSERT INTO wewed_contracts."PaymentMilestone"
  (id,"serviceEngagementId","weddingId","bookingId","milestoneType",label,description,amount,currency,status,sequence,"proofRequired","createdById")
VALUES ('ci-sql-deposit','ci-engagement','ci-wedding','ci-sql-booking','DEPOSIT','CI deposit','Deposit truth contract',50.00,'USD','PLANNED',0,false,'ci-user');
INSERT INTO wewed_contracts."ManagedPaymentRecord"
  (id,"serviceEngagementId","weddingId","milestoneId","entryType",amount,currency,"paidAt",source,"proofRequired","proofWaiverReason","recordedById")
VALUES ('ci-sql-payment','ci-engagement','ci-wedding','ci-sql-deposit','PAYMENT',50.00,'USD',CURRENT_TIMESTAMP,'MANUAL_FACT',false,'CI fixture','ci-user');
INSERT INTO wewed_contracts."ManagedPaymentRecord"
  (id,"serviceEngagementId","weddingId","milestoneId","entryType",amount,currency,"paidAt",source,"proofRequired","proofWaiverReason","recordedById")
VALUES ('ci-sql-refund','ci-engagement','ci-wedding','ci-sql-deposit','REFUND',50.00,'USD',CURRENT_TIMESTAMP,'CORRECTION_FACT',false,'CI fixture','ci-user');
INSERT INTO wewed_contracts."ManagedPaymentRecord"
  (id,"serviceEngagementId","weddingId","milestoneId","entryType",amount,currency,"paidAt",source,"proofRequired","proofWaiverReason","reversesPaymentId","recordedById")
VALUES ('ci-sql-refund-reversal','ci-engagement','ci-wedding','ci-sql-deposit','REVERSAL',50.00,'USD',CURRENT_TIMESTAMP,'CORRECTION_FACT',false,'CI fixture','ci-sql-refund','ci-user');
COMMIT;

DO $$
BEGIN
  IF NOT wewed_booking.booking_deposit_is_satisfied('ci-sql-booking') THEN
    RAISE EXCEPTION 'refund reversal sign contract failed: reversed refund did not restore deposit satisfaction';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_booking."Booking"
      (id,"publicReference","businessAccountId","offeringId","weddingId","customerUserId","createdByUserId","bookingMode",status,currency)
    VALUES ('ci-direct-confirmed','WW-CI-DIRECT-CONFIRMED','ci-business','ci-sql-offering','ci-wedding','ci-user','ci-user','instant','confirmed','USD');
    RAISE EXCEPTION 'confirmed insert guard failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%booking_confirmed_insert_forbidden%' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE wewed_booking."BookingEvent" SET metadata='{"rewritten":true}'::jsonb WHERE id='ci-sql-event';
    RAISE EXCEPTION 'booking event append-only guard failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%booking_events_are_append_only%' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    DELETE FROM wewed_booking."BookingEvent" WHERE id='ci-sql-event';
    RAISE EXCEPTION 'booking event delete guard failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%booking_events_are_append_only%' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE wewed_booking."BookingAmendment" SET summary='Rewritten proposal' WHERE id='ci-sql-amendment';
    RAISE EXCEPTION 'amendment immutable snapshot guard failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%booking_amendment_proposal_is_immutable%' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    DELETE FROM wewed_booking."BookingAmendment" WHERE id='ci-sql-amendment';
    RAISE EXCEPTION 'amendment delete guard failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%booking_amendments_cannot_be_deleted%' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE wewed_booking."BookingLine" SET quantity=2 WHERE id='ci-sql-line';
    RAISE EXCEPTION 'submitted booking line rewrite guard failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%booking_line_commercial_snapshot_is_immutable%' THEN RAISE; END IF;
  END;
END $$;

-- Anonymous/authenticated roles must never gain direct booking-domain table mutation rights.
DO $$
DECLARE role_name text;
DECLARE leaked integer;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      SELECT count(*) INTO leaked
        FROM information_schema.role_table_grants
       WHERE grantee=role_name AND table_schema='wewed_booking'
         AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES');
      IF leaked <> 0 THEN RAISE EXCEPTION 'booking schema write privilege leaked to %',role_name; END IF;
    END IF;
  END LOOP;
END $$;

SELECT 'Booking commerce PostgreSQL governance contract: PASS' AS result;