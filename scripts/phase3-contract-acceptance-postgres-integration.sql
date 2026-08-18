\set ON_ERROR_STOP on

DO $$
BEGIN
  IF to_regnamespace('wewed_contracts') IS NULL THEN RAISE EXCEPTION 'wewed_contracts schema missing'; END IF;
  IF to_regclass('wewed_contracts."ContractPartyRequirement"') IS NULL THEN RAISE EXCEPTION 'ContractPartyRequirement missing'; END IF;
  IF to_regclass('wewed_contracts."ContractAcceptance"') IS NULL THEN RAISE EXCEPTION 'ContractAcceptance missing'; END IF;
  IF to_regclass('wewed_contracts."ContractVersionEffectivity"') IS NULL THEN RAISE EXCEPTION 'ContractVersionEffectivity missing'; END IF;
  IF to_regclass('wewed_contracts."ContractAmendment"') IS NULL THEN RAISE EXCEPTION 'ContractAmendment missing'; END IF;
END $$;

DO $$
DECLARE contract_check text; version_check text; lifecycle_check text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO contract_check FROM pg_constraint WHERE conname='Contract_status_check' AND conrelid='public."Contract"'::regclass;
  SELECT pg_get_constraintdef(oid) INTO version_check FROM pg_constraint WHERE conname='ContractVersion_status_check' AND conrelid='public."ContractVersion"'::regclass;
  SELECT pg_get_constraintdef(oid) INTO lifecycle_check FROM pg_constraint WHERE conname='ServiceEngagement_lifecycleStatus_check' AND conrelid='public."ServiceEngagement"'::regclass;
  IF contract_check NOT LIKE '%PARTIALLY_ACCEPTED%' THEN RAISE EXCEPTION 'Contract PARTIALLY_ACCEPTED missing'; END IF;
  IF version_check NOT LIKE '%PARTIALLY_ACCEPTED%' THEN RAISE EXCEPTION 'ContractVersion PARTIALLY_ACCEPTED missing'; END IF;
  IF lifecycle_check NOT LIKE '%partially_accepted%' OR lifecycle_check NOT LIKE '%effective%' OR lifecycle_check NOT LIKE '%rejected%' THEN
    RAISE EXCEPTION 'ServiceEngagement Phase 3 lifecycle states missing';
  END IF;
END $$;

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(expected, ', ') INTO missing
  FROM (VALUES
    ('ContractAcceptance_append_only_guard'),
    ('ContractVersionEffectivity_append_only_guard'),
    ('ContractPartyRequirement_identity_guard'),
    ('ContractAmendment_finality_guard'),
    ('ContractVersion_phase3_lifecycle_guard'),
    ('ContractPartyRequirement_contract_party_guard'),
    ('ContractAcceptance_party_snapshot_guard'),
    ('EngagementParty_accepted_identity_guard')
  ) AS required(expected)
  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname=required.expected AND NOT tgisinternal);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing Phase 3 triggers: %', missing; END IF;
END $$;

DO $$
DECLARE display_nullable text; identity_fk bigint;
BEGIN
  SELECT is_nullable INTO display_nullable
  FROM information_schema.columns
  WHERE table_schema='wewed_contracts' AND table_name='ContractAcceptance' AND column_name='partyDisplayName';
  IF display_nullable IS DISTINCT FROM 'NO' THEN RAISE EXCEPTION 'Acceptance party display-name snapshot must be NOT NULL'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='wewed_contracts' AND table_name='ContractAcceptance' AND column_name='partyLegalName'
  ) THEN RAISE EXCEPTION 'Acceptance party legal-name snapshot missing'; END IF;
  SELECT count(*) INTO identity_fk
  FROM pg_constraint
  WHERE conname='ContractAcceptance_requirement_identity_fkey'
    AND conrelid='wewed_contracts."ContractAcceptance"'::regclass;
  IF identity_fk <> 1 THEN RAISE EXCEPTION 'Acceptance requirement identity FK missing'; END IF;
END $$;

DO $$
DECLARE leaked bigint;
BEGIN
  SELECT count(*) INTO leaked
  FROM information_schema.role_table_grants
  WHERE table_schema='wewed_contracts' AND grantee IN ('PUBLIC','anon','authenticated');
  IF leaked <> 0 THEN RAISE EXCEPTION 'Client/browser roles have direct Phase 3 table grants: %', leaked; END IF;
END $$;

DO $$
DECLARE acceptance_def text; effectivity_def text; lifecycle_def text; party_def text; snapshot_def text; requirement_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO acceptance_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='wewed_contracts' AND p.proname='enforce_acceptance_append_only';
  SELECT pg_get_functiondef(p.oid) INTO effectivity_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='wewed_contracts' AND p.proname='enforce_effectivity_append_only';
  SELECT pg_get_functiondef(p.oid) INTO lifecycle_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='wewed_contracts' AND p.proname='enforce_contract_version_lifecycle';
  SELECT pg_get_functiondef(p.oid) INTO party_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='wewed_contracts' AND p.proname='enforce_accepted_party_identity_immutability';
  SELECT pg_get_functiondef(p.oid) INTO snapshot_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='wewed_contracts' AND p.proname='capture_acceptance_party_snapshot';
  SELECT pg_get_functiondef(p.oid) INTO requirement_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='wewed_contracts' AND p.proname='validate_requirement_contract_party';
  IF acceptance_def NOT LIKE '%append-only%' THEN RAISE EXCEPTION 'Acceptance append-only guard body missing'; END IF;
  IF effectivity_def NOT LIKE '%append-only%' THEN RAISE EXCEPTION 'Effectivity append-only guard body missing'; END IF;
  IF lifecycle_def NOT LIKE '%cannot regress%' OR lifecycle_def NOT LIKE '%Superseded contract versions are final%' THEN RAISE EXCEPTION 'ContractVersion finality guard incomplete'; END IF;
  IF party_def NOT LIKE '%Accepted contract party identity is immutable%' THEN RAISE EXCEPTION 'Accepted-party identity guard incomplete'; END IF;
  IF snapshot_def NOT LIKE '%partyDisplayName%' THEN RAISE EXCEPTION 'Acceptance party snapshot guard incomplete'; END IF;
  IF requirement_def NOT LIKE '%contract service engagement and wedding%' OR requirement_def NOT LIKE '%governed party role%' THEN RAISE EXCEPTION 'Requirement Contract/Party guard incomplete'; END IF;
END $$;

-- The migration may backfill requirements from Phase 2 review grants, but it must never invent acceptance rows.
DO $$
DECLARE orphaned bigint;
BEGIN
  SELECT count(*) INTO orphaned
  FROM wewed_contracts."ContractAcceptance" a
  LEFT JOIN wewed_contracts."ContractPartyRequirement" r
    ON r."id"=a."requirementId"
   AND r."contractId"=a."contractId"
   AND r."contractVersionId"=a."contractVersionId"
   AND r."engagementPartyId"=a."engagementPartyId"
  WHERE r."id" IS NULL;
  IF orphaned <> 0 THEN RAISE EXCEPTION 'Acceptance without exact requirement identity detected'; END IF;
END $$;

SELECT 'phase3_contract_acceptance_amendments_ok' AS result;
