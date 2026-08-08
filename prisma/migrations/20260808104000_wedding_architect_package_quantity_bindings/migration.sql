-- Package-level deterministic quantity bindings for Wedding Architect.
-- These fields are additive and remain null for legacy packages, which therefore
-- cannot use variable additional-unit pricing in automatic plans until completed.

ALTER TABLE wewed_admin."ProviderPackage"
  ADD COLUMN IF NOT EXISTS "quantityKey" TEXT,
  ADD COLUMN IF NOT EXISTS "multiplierKey" TEXT;

CREATE OR REPLACE VIEW public."ProviderPackage" WITH (security_invoker = true) AS
SELECT * FROM wewed_admin."ProviderPackage";

REVOKE ALL PRIVILEGES ON TABLE public."ProviderPackage" FROM PUBLIC;
DO $provider_package_binding_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public."ProviderPackage" FROM %I', role_name);
    END IF;
  END LOOP;
END
$provider_package_binding_roles$;
