\set ON_ERROR_STOP on

DO $pre_uat_security$
DECLARE
  function_oid oid;
  function_config text[];
  public_can_execute boolean;
BEGIN
  function_oid := to_regprocedure('wewed_admin.normalize_provider_identity(text)');
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'normalize_provider_identity(text) is missing from the canonical migration chain';
  END IF;

  SELECT p.proconfig,
         EXISTS (
           SELECT 1
           FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
           WHERE acl.grantee = 0
             AND acl.privilege_type = 'EXECUTE'
         )
  INTO function_config, public_can_execute
  FROM pg_proc p
  WHERE p.oid = function_oid;

  IF NOT EXISTS (
    SELECT 1 FROM unnest(COALESCE(function_config, ARRAY[]::text[])) config
    WHERE config LIKE 'search_path=%pg_catalog%wewed_admin%'
  ) THEN
    RAISE EXCEPTION 'normalize_provider_identity(text) does not have a fixed hardened search_path: %', function_config;
  END IF;

  IF public_can_execute THEN
    RAISE EXCEPTION 'normalize_provider_identity(text) still grants EXECUTE to PUBLIC';
  END IF;

  function_oid := to_regprocedure('wewed_admin.provider_identity_requires_review(text,text)');
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'provider_identity_requires_review(text,text) is missing from the canonical migration chain';
  END IF;

  SELECT p.proconfig,
         EXISTS (
           SELECT 1
           FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
           WHERE acl.grantee = 0
             AND acl.privilege_type = 'EXECUTE'
         )
  INTO function_config, public_can_execute
  FROM pg_proc p
  WHERE p.oid = function_oid;

  IF NOT EXISTS (
    SELECT 1 FROM unnest(COALESCE(function_config, ARRAY[]::text[])) config
    WHERE config LIKE 'search_path=%pg_catalog%wewed_admin%'
  ) THEN
    RAISE EXCEPTION 'provider_identity_requires_review(text,text) does not have a fixed hardened search_path: %', function_config;
  END IF;

  IF public_can_execute THEN
    RAISE EXCEPTION 'provider_identity_requires_review(text,text) still grants EXECUTE to PUBLIC';
  END IF;
END
$pre_uat_security$;
