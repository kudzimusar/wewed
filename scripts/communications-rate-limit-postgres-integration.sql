\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF to_regclass('wewed_communications."CommunicationRateLimitBucket"') IS NULL THEN
    RAISE EXCEPTION 'CommunicationRateLimitBucket is missing';
  END IF;
  IF to_regprocedure('wewed_communications.consume_rate_limit(text,text,integer,integer,integer)') IS NULL THEN
    RAISE EXCEPTION 'communications consume_rate_limit function is missing';
  END IF;
END
$$;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      IF has_table_privilege(role_name, 'wewed_communications."CommunicationRateLimitBucket"', 'SELECT') OR
         has_table_privilege(role_name, 'wewed_communications."CommunicationRateLimitBucket"', 'INSERT') OR
         has_table_privilege(role_name, 'wewed_communications."CommunicationRateLimitBucket"', 'UPDATE') THEN
        RAISE EXCEPTION '% unexpectedly has rate-limit table privileges', role_name;
      END IF;
      IF has_function_privilege(role_name, 'wewed_communications.consume_rate_limit(text,text,integer,integer,integer)', 'EXECUTE') THEN
        RAISE EXCEPTION '% unexpectedly can execute the private rate limiter', role_name;
      END IF;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  decision record;
  stored_key text;
  stored_scope text;
BEGIN
  SELECT * INTO decision
  FROM wewed_communications."consume_rate_limit"(
    repeat('a', 64), 'message_send', 2, 3, 60
  );
  IF NOT decision.allowed OR decision.remaining <> 1 THEN
    RAISE EXCEPTION 'first rate-limit consumption should be allowed with one remaining';
  END IF;

  SELECT * INTO decision
  FROM wewed_communications."consume_rate_limit"(
    repeat('a', 64), 'message_send', 2, 3, 60
  );
  IF decision.allowed OR decision.retry_after < 1 OR decision.retry_after > 60 THEN
    RAISE EXCEPTION 'rate-limit exhaustion did not reject with a valid retry_after';
  END IF;

  SELECT "keyHash", "scope" INTO stored_key, stored_scope
  FROM wewed_communications."CommunicationRateLimitBucket"
  WHERE "keyHash" = repeat('a', 64)
  LIMIT 1;
  IF stored_key <> repeat('a', 64) OR stored_scope <> 'message_send' THEN
    RAISE EXCEPTION 'rate-limit state does not contain the expected hashed key/scope only';
  END IF;

  -- Simulate expiration without sleeping so the next call proves a fresh window works.
  UPDATE wewed_communications."CommunicationRateLimitBucket"
  SET "windowStart" = "windowStart" - interval '2 minutes',
      "expiresAt" = now() - interval '1 second'
  WHERE "keyHash" = repeat('a', 64);

  SELECT * INTO decision
  FROM wewed_communications."consume_rate_limit"(
    repeat('a', 64), 'message_send', 1, 3, 60
  );
  IF NOT decision.allowed OR decision.remaining <> 2 THEN
    RAISE EXCEPTION 'expired rate-limit window did not reset';
  END IF;

  SELECT * INTO decision
  FROM wewed_communications."consume_rate_limit"(
    repeat('b', 64), 'recipient_fanout', 5, 4, 60
  );
  IF decision.allowed THEN
    RAISE EXCEPTION 'single fanout cost above the limit was unexpectedly allowed';
  END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM * FROM wewed_communications."consume_rate_limit"(
      'raw-user-id', 'message_send', 1, 3, 60
    );
    RAISE EXCEPTION 'unhashed rate-limit key was accepted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'unhashed rate-limit key was accepted' THEN
        RAISE;
      END IF;
  END;
END
$$;

ROLLBACK;

\echo 'Wewed communications rate-limit PostgreSQL integration contract: PASS'
