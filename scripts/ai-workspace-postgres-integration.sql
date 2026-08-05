\set ON_ERROR_STOP on

DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
  index_name text;
BEGIN
  FOREACH index_name IN ARRAY ARRAY[
    'ContentRevision_ai_workspace_idx',
    'WeddingContent_ai_document_lookup_idx',
    'WeddingContent_ai_document_search_idx',
    'AiRateLimitBucket_expiresAt_idx'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = index_name
    ) THEN
      missing := array_append(missing, index_name);
    END IF;
  END LOOP;

  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'Missing Wewed AI workspace indexes: %', array_to_string(missing, ', ');
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public."AiRateLimitBucket"') IS NULL THEN
    RAISE EXCEPTION 'Missing distributed AI rate-limit table.';
  END IF;
END
$$;

DO $$
DECLARE
  matched boolean;
BEGIN
  SELECT
    to_tsvector('simple', 'supplier access begins at eight')
      @@ websearch_to_tsquery('simple', 'supplier access')
  INTO matched;

  IF matched IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PostgreSQL full-text search contract failed.';
  END IF;
END
$$;

DO $$
DECLARE
  first_count integer;
  second_count integer;
  test_window timestamptz := date_trunc('minute', NOW());
BEGIN
  DELETE FROM public."AiRateLimitBucket"
  WHERE "keyHash" = repeat('a', 64);

  INSERT INTO public."AiRateLimitBucket" (
    "keyHash", "windowStart", "count", "expiresAt"
  ) VALUES (
    repeat('a', 64), test_window, 1, test_window + INTERVAL '2 minutes'
  )
  ON CONFLICT ("keyHash", "windowStart")
  DO UPDATE SET "count" = public."AiRateLimitBucket"."count" + 1
  RETURNING "count" INTO first_count;

  INSERT INTO public."AiRateLimitBucket" (
    "keyHash", "windowStart", "count", "expiresAt"
  ) VALUES (
    repeat('a', 64), test_window, 1, test_window + INTERVAL '2 minutes'
  )
  ON CONFLICT ("keyHash", "windowStart")
  DO UPDATE SET "count" = public."AiRateLimitBucket"."count" + 1
  RETURNING "count" INTO second_count;

  IF first_count <> 1 OR second_count <> 2 THEN
    RAISE EXCEPTION 'Distributed AI rate-limit increment contract failed: %, %', first_count, second_count;
  END IF;

  DELETE FROM public."AiRateLimitBucket"
  WHERE "keyHash" = repeat('a', 64);
END
$$;

SELECT 'Wewed AI workspace PostgreSQL integration passed.' AS result;
