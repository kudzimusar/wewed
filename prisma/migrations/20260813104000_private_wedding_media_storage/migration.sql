-- Durable wedding media storage.
--
-- Wewed's normal CI database is plain PostgreSQL, so the Supabase `storage`
-- schema is not present there. This migration therefore provisions the bucket
-- only when the target database exposes Supabase Storage. On production
-- Supabase the bucket is private: wedding access is checked by Wewed before a
-- short-lived signed URL is returned.

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
      )
      VALUES (
        'wedding-media',
        'wedding-media',
        false,
        10485760,
        ARRAY[
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'video/mp4',
          'video/webm'
        ]::text[]
      )
      ON CONFLICT (id) DO UPDATE
      SET public = false,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types,
          updated_at = now()
    $sql$;
  END IF;
END
$$;
