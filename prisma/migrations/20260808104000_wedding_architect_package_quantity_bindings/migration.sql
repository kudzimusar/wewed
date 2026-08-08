-- Package-level deterministic quantity bindings for Wedding Architect.
-- These fields are additive and remain null for legacy packages, which therefore
-- cannot use variable additional-unit pricing in automatic plans until completed.

ALTER TABLE wewed_admin."ProviderPackage"
  ADD COLUMN IF NOT EXISTS "quantityType" TEXT,
  ADD COLUMN IF NOT EXISTS "quantityKey" TEXT,
  ADD COLUMN IF NOT EXISTS "multiplierKey" TEXT;

DO $package_quantity_type_constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPackage_quantityType_check') THEN
    ALTER TABLE wewed_admin."ProviderPackage"
      ADD CONSTRAINT "ProviderPackage_quantityType_check"
      CHECK (
        "quantityType" IS NULL OR "quantityType" IN (
          'per_guest','per_adult','per_child','per_item','per_serving','per_table',
          'per_room','per_vehicle','per_hour','per_day','per_night','per_session',
          'per_kilometre','per_trip'
        )
      );
  END IF;
END
$package_quantity_type_constraint$;

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
