-- Keep parent-company operations outside the Prisma-managed public wedding schema.
-- Compatibility views preserve existing server-side SQL while remaining unavailable to Supabase clients.

CREATE SCHEMA IF NOT EXISTS wewed_admin;
REVOKE ALL ON SCHEMA wewed_admin FROM PUBLIC;

DO $wewed_schema_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_admin FROM %I', role_name);
    END IF;
  END LOOP;
END
$wewed_schema_roles$;

ALTER TABLE public."BusinessAccount" SET SCHEMA wewed_admin;
ALTER TABLE public."BusinessAccountMember" SET SCHEMA wewed_admin;
ALTER TABLE public."BusinessAccountLink" SET SCHEMA wewed_admin;
ALTER TABLE public."PaymentRecord" SET SCHEMA wewed_admin;
ALTER TABLE public."SupportCase" SET SCHEMA wewed_admin;
ALTER TABLE public."PlatformIncident" SET SCHEMA wewed_admin;
ALTER TABLE public."BusinessAuditLog" SET SCHEMA wewed_admin;

CREATE VIEW public."BusinessAccount" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."BusinessAccount";
CREATE VIEW public."BusinessAccountMember" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."BusinessAccountMember";
CREATE VIEW public."BusinessAccountLink" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."BusinessAccountLink";
CREATE VIEW public."PaymentRecord" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."PaymentRecord";
CREATE VIEW public."SupportCase" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."SupportCase";
CREATE VIEW public."PlatformIncident" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."PlatformIncident";
CREATE VIEW public."BusinessAuditLog" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."BusinessAuditLog";

REVOKE ALL PRIVILEGES ON TABLE public."BusinessAccount" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessAccountMember" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessAccountLink" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."PaymentRecord" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."SupportCase" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."PlatformIncident" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessAuditLog" FROM PUBLIC;

DO $wewed_view_roles$
DECLARE
  role_name text;
  view_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOREACH view_name IN ARRAY ARRAY[
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
          view_name,
          role_name
        );
      END LOOP;
    END IF;
  END LOOP;
END
$wewed_view_roles$;
