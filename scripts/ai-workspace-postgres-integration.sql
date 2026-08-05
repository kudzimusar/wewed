\set ON_ERROR_STOP on

DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
  index_name text;
BEGIN
  FOREACH index_name IN ARRAY ARRAY[
    'ContentRevision_ai_workspace_idx',
    'WeddingContent_ai_document_lookup_idx',
    'WeddingContent_ai_document_search_idx'
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

SELECT 'Wewed AI workspace PostgreSQL integration passed.' AS result;
