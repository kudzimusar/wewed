-- Keep parent-company operations outside the Prisma-managed public wedding schema.
-- Compatibility views preserve the existing server-side SQL while remaining unavailable to Supabase clients.

CREATE SCHEMA IF NOT EXISTS wewed_admin;
REVOKE ALL ON SCHEMA wewed_admin FROM PUBLIC, anon, authenticated;

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

REVOKE ALL PRIVILEGES ON TABLE public."BusinessAccount" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessAccountMember" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessAccountLink" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."PaymentRecord" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."SupportCase" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."PlatformIncident" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessAuditLog" FROM PUBLIC, anon, authenticated;
