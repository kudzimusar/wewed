-- The Wewed business administration tables are server-only.
-- Prisma connects through the database role; Supabase client roles must not access them directly.

ALTER TABLE public."BusinessAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessAccountMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessAccountLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PlatformIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessAuditLog" ENABLE ROW LEVEL SECURITY;

DO $wewed_security$
DECLARE
  role_name text;
  table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY ARRAY[
        'BusinessAccount',
        'BusinessAccountMember',
        'BusinessAccountLink',
        'PaymentRecord',
        'SupportCase',
        'PlatformIncident',
        'BusinessAuditLog'
      ] LOOP
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',
          table_name,
          role_name
        );
      END LOOP;
    END IF;
  END LOOP;
END
$wewed_security$;
