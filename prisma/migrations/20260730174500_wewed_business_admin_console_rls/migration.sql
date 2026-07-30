-- The Wewed business administration tables are server-only.
-- Prisma connects through the database role; Supabase anon/authenticated clients must not access them directly.

ALTER TABLE public."BusinessAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessAccountMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessAccountLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PlatformIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BusinessAuditLog" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."BusinessAccount" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessAccountMember" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessAccountLink" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."PaymentRecord" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."SupportCase" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."PlatformIncident" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessAuditLog" FROM anon, authenticated;
