-- Booking migration compatibility for clean PostgreSQL CI and Supabase production.
-- Supabase normally provides anon/authenticated roles. The repository's clean PostgreSQL
-- migration gate does not, so create inert NOLOGIN compatibility roles only when absent.
-- On Supabase this migration is a no-op because the roles already exist.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;
