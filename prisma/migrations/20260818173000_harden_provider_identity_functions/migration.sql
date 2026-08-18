-- Pre-UAT security hardening for provider identity helpers.
--
-- These functions are server/database utilities. They do not require browser-role
-- execution, and their lookup path must not depend on caller-controlled schemas.
-- CREATE OR REPLACE also makes the canonical clean-database migration chain match
-- the already-deployed production helpers before tightening their ACLs.

CREATE OR REPLACE FUNCTION wewed_admin.normalize_provider_identity(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, wewed_admin
AS $function$
  SELECT regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '', 'g');
$function$;

CREATE OR REPLACE FUNCTION wewed_admin.provider_identity_requires_review(
  candidate_name text,
  exclude_business_account_id text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, wewed_admin
AS $function$
  WITH candidate AS (
    SELECT wewed_admin.normalize_provider_identity(candidate_name) AS n
  )
  SELECT EXISTS (
    SELECT 1
    FROM wewed_admin."ProviderProfile" p, candidate c
    WHERE (exclude_business_account_id IS NULL OR p."businessAccountId" <> exclude_business_account_id)
      AND length(c.n) > 0
      AND (
        wewed_admin.normalize_provider_identity(p."displayName") = c.n
        OR (
          length(c.n) > 5
          AND length(wewed_admin.normalize_provider_identity(p."displayName")) > 5
          AND (
            wewed_admin.normalize_provider_identity(p."displayName") LIKE '%' || c.n || '%'
            OR c.n LIKE '%' || wewed_admin.normalize_provider_identity(p."displayName") || '%'
          )
        )
      )
  );
$function$;

-- Internal helpers are not public application APIs. The database owner keeps
-- execution authority; browser-facing Supabase roles do not receive it.
REVOKE ALL ON FUNCTION wewed_admin.normalize_provider_identity(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION wewed_admin.provider_identity_requires_review(text, text) FROM PUBLIC;

DO $revoke_browser_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION wewed_admin.normalize_provider_identity(text) FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL ON FUNCTION wewed_admin.provider_identity_requires_review(text, text) FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$revoke_browser_roles$;
