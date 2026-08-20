-- Notification/attention storage contains private account and wedding data.
-- Keep it server-only by default. PostgreSQL table owners/service roles retain
-- their normal privileged access; browser-facing Supabase roles receive no
-- direct table privileges and no RLS policies are opened by this release.

ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Reminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationDeliveryAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PushSubscription" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."Notification" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."Reminder" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."NotificationPreference" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."NotificationDeliveryAttempt" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."PushSubscription" FROM PUBLIC;

DO $wewed_notification_storage_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."Notification" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."Reminder" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."NotificationPreference" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."NotificationDeliveryAttempt" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."PushSubscription" FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."Notification" FROM authenticated';
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."Reminder" FROM authenticated';
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."NotificationPreference" FROM authenticated';
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."NotificationDeliveryAttempt" FROM authenticated';
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."PushSubscription" FROM authenticated';
  END IF;
END
$wewed_notification_storage_roles$;
