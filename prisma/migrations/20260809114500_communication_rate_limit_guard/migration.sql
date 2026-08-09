-- Wewed communications distributed abuse/fanout guard.
-- The limiter is private, stores only hashed actor/scope keys, and is evaluated
-- by trusted server-side application code before communication mutations.

CREATE TABLE wewed_communications."CommunicationRateLimitBucket" (
  "id" text PRIMARY KEY,
  "keyHash" text NOT NULL,
  "scope" text NOT NULL,
  "windowStart" timestamptz NOT NULL,
  "requestCount" integer NOT NULL DEFAULT 0 CHECK ("requestCount" >= 0),
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationRateLimitBucket_key_window_key" UNIQUE ("keyHash", "windowStart")
);

CREATE INDEX "CommunicationRateLimitBucket_expires_idx"
  ON wewed_communications."CommunicationRateLimitBucket" ("expiresAt");
CREATE INDEX "CommunicationRateLimitBucket_scope_window_idx"
  ON wewed_communications."CommunicationRateLimitBucket" ("scope", "windowStart");

CREATE FUNCTION wewed_communications."consume_rate_limit"(
  p_key_hash text,
  p_scope text,
  p_cost integer,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, wewed_communications
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count integer;
  v_retry integer;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) <> 64 OR p_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid communication rate-limit key';
  END IF;
  IF p_scope IS NULL OR length(p_scope) < 1 OR length(p_scope) > 64 OR p_scope !~ '^[a-z0-9_:-]+$' THEN
    RAISE EXCEPTION 'invalid communication rate-limit scope';
  END IF;
  IF p_cost < 1 OR p_limit < 1 OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid communication rate-limit parameters';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );
  v_window_end := v_window_start + make_interval(secs => p_window_seconds);
  v_retry := GREATEST(1, CEIL(extract(epoch FROM (v_window_end - v_now)))::integer);

  -- Opportunistic cleanup is restricted to the current hashed actor/scope key.
  DELETE FROM wewed_communications."CommunicationRateLimitBucket"
  WHERE "keyHash" = p_key_hash AND "expiresAt" < v_now;

  IF p_cost > p_limit THEN
    RETURN QUERY SELECT false, v_retry, 0;
    RETURN;
  END IF;

  INSERT INTO wewed_communications."CommunicationRateLimitBucket"
    ("id", "keyHash", "scope", "windowStart", "requestCount", "expiresAt", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    p_key_hash,
    p_scope,
    v_window_start,
    p_cost,
    v_window_end + make_interval(secs => p_window_seconds),
    v_now,
    v_now
  )
  ON CONFLICT ("keyHash", "windowStart") DO UPDATE
  SET "requestCount" = wewed_communications."CommunicationRateLimitBucket"."requestCount" + EXCLUDED."requestCount",
      "updatedAt" = v_now,
      "expiresAt" = GREATEST(wewed_communications."CommunicationRateLimitBucket"."expiresAt", EXCLUDED."expiresAt")
  WHERE wewed_communications."CommunicationRateLimitBucket"."requestCount" + EXCLUDED."requestCount" <= p_limit
  RETURNING "requestCount" INTO v_count;

  IF v_count IS NULL THEN
    RETURN QUERY SELECT false, v_retry, 0;
  ELSE
    RETURN QUERY SELECT true, v_retry, GREATEST(0, p_limit - v_count);
  END IF;
END
$$;

REVOKE ALL PRIVILEGES ON TABLE wewed_communications."CommunicationRateLimitBucket" FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_communications."consume_rate_limit"(text, text, integer, integer, integer) FROM PUBLIC;

DO $wewed_rate_limit_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE wewed_communications."CommunicationRateLimitBucket" FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION wewed_communications."consume_rate_limit"(text, text, integer, integer, integer) FROM %I', role_name);
    END IF;
  END LOOP;
END
$wewed_rate_limit_roles$;
