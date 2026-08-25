-- Prevent stale cross-device read/unread mutations from downgrading handled notifications.
-- The application already models acknowledged/resolved/cancelled/expired as protected states;
-- this trigger makes that invariant atomic at the database boundary so a concurrent request
-- cannot overwrite a newer lifecycle decision with a state computed from an older snapshot.

CREATE SCHEMA IF NOT EXISTS wewed_admin;
REVOKE ALL ON SCHEMA wewed_admin FROM PUBLIC;

CREATE OR REPLACE FUNCTION wewed_admin.enforce_notification_state_race_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  -- Terminal states are immutable. A delayed request based on an older active/read snapshot
  -- must never reopen or otherwise downgrade a terminal notification.
  IF OLD.state IN ('resolved', 'cancelled', 'expired') AND NEW.state IS DISTINCT FROM OLD.state THEN
    NEW.state := OLD.state;
    NEW."readAt" := OLD."readAt";
    NEW."acknowledgedAt" := OLD."acknowledgedAt";
    NEW."resolvedAt" := OLD."resolvedAt";
    RETURN NEW;
  END IF;

  -- Acknowledgement is stronger than ordinary read/unread state. Preserve it when an older
  -- read-state mutation arrives after acknowledgement from another device/session.
  IF OLD.state = 'acknowledged' AND NEW.state IN ('active', 'read') THEN
    NEW.state := 'acknowledged';
    NEW."readAt" := COALESCE(OLD."readAt", NEW."readAt", CURRENT_TIMESTAMP);
    NEW."acknowledgedAt" := COALESCE(OLD."acknowledgedAt", NEW."acknowledgedAt", CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION wewed_admin.enforce_notification_state_race_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS notification_state_race_guard ON public."Notification";
CREATE TRIGGER notification_state_race_guard
BEFORE UPDATE OF state, "readAt", "acknowledgedAt", "resolvedAt"
ON public."Notification"
FOR EACH ROW
EXECUTE FUNCTION wewed_admin.enforce_notification_state_race_guard();
