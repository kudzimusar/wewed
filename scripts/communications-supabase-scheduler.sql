-- Supabase-hosted production scheduler for Wewed external communications.
--
-- This is intentionally separate from the portable Prisma migration because
-- stock PostgreSQL CI images do not ship Supabase pg_net/pg_cron extensions.
-- The scheduler secret is generated inside Postgres, stored encrypted in Vault,
-- and only its SHA-256 digest is stored in wewed_communications.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $provision$
DECLARE
  scheduler_secret text;
BEGIN
  SELECT decrypted_secret
    INTO scheduler_secret
  FROM vault.decrypted_secrets
  WHERE name = 'wewed_communications_scheduler_secret'
  LIMIT 1;

  IF scheduler_secret IS NULL THEN
    scheduler_secret := encode(extensions.gen_random_bytes(32), 'hex');
    PERFORM vault.create_secret(
      scheduler_secret,
      'wewed_communications_scheduler_secret',
      'Server-generated bearer credential for the Wewed communications scheduler.'
    );
  END IF;

  INSERT INTO wewed_communications."CommunicationSchedulerCredential"
    ("id", "secretHash", "createdAt", "updatedAt")
  VALUES (
    'automatic_dispatch',
    encode(extensions.digest(scheduler_secret, 'sha256'), 'hex'),
    now(),
    now()
  )
  ON CONFLICT ("id") DO UPDATE SET
    "secretHash" = EXCLUDED."secretHash",
    "updatedAt" = now();
END
$provision$;

SELECT cron.schedule(
  'wewed-communications-automatic-dispatch',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := 'https://wewed.pro/api/cron/communications-deliveries',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'wewed_communications_scheduler_secret'
          LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    ) AS request_id;
  $job$
);
