\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public."Couple" ("id", "slug", "partner1", "partner2", "updatedAt")
VALUES ('phase2-couple-a', 'phase2-couple-a', 'Phase', 'Two', now()),
       ('phase2-couple-b', 'phase2-couple-b', 'Other', 'Wedding', now());

INSERT INTO public."Wedding" (
  "id", "slug", "title", "date", "venue", "venueCity", "venueCountry", "coupleId", "updatedAt"
) VALUES
  ('phase2-wedding-a', 'phase2-wedding-a', 'Phase 2 Wedding', now() + interval '90 days', 'Venue A', 'Harare', 'Zimbabwe', 'phase2-couple-a', now()),
  ('phase2-wedding-b', 'phase2-wedding-b', 'Other Wedding', now() + interval '120 days', 'Venue B', 'Bulawayo', 'Zimbabwe', 'phase2-couple-b', now());

INSERT INTO public."Vendor" ("id", "name", "category", "weddingId", "updatedAt")
VALUES ('phase2-vendor-a', 'Phase 2 Photography', 'Photography', 'phase2-wedding-a', now());

INSERT INTO public."ServiceEngagement" (
  "id", "origin", "recordMode", "lifecycleStatus", "serviceCategory",
  "serviceDescription", "agreedAmount", "currency", "weddingId", "vendorId", "createdById", "updatedAt"
) VALUES (
  'phase2-engagement-a', 'current', 'managed_contract', 'draft', 'Photography',
  'Wedding photography coverage', 3500.00, 'USD', 'phase2-wedding-a', 'phase2-vendor-a', 'phase2-test-actor', now()
);

INSERT INTO public."EngagementParty" (
  "id", "serviceEngagementId", "weddingId", "partyRole", "partyKind", "displayName", "requiredForReview", "updatedAt"
) VALUES
  ('phase2-party-client', 'phase2-engagement-a', 'phase2-wedding-a', 'CLIENT', 'COUPLE', 'Phase & Two', true, now()),
  ('phase2-party-planner', 'phase2-engagement-a', 'phase2-wedding-a', 'PLANNER', 'PLANNING_COMPANY', 'Planner Co', true, now()),
  ('phase2-party-vendor', 'phase2-engagement-a', 'phase2-wedding-a', 'SERVICE_PROVIDER', 'VENDOR', 'Phase 2 Photography', true, now());

DO $$
BEGIN
  BEGIN
    INSERT INTO public."EngagementParty" (
      "id", "serviceEngagementId", "weddingId", "partyRole", "partyKind", "displayName", "updatedAt"
    ) VALUES (
      'phase2-party-cross-wedding', 'phase2-engagement-a', 'phase2-wedding-b',
      'CLIENT', 'COUPLE', 'Wrong wedding', now()
    );
    RAISE EXCEPTION 'Cross-wedding engagement party insert unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

INSERT INTO public."ContractClause" (
  "id", "code", "version", "title", "clauseFamily", "body", "contentHash", "updatedAt"
) VALUES (
  'phase2-clause-scope', 'COMMON_SCOPE', '1.0.0', 'Scope of service', 'scope',
  'The service provider will deliver the scope recorded in this agreement.',
  repeat('a', 64), now()
);

INSERT INTO public."ContractTemplate" (
  "id", "code", "title", "serviceCategory", "semanticVersion", "templateHash", "status", "updatedAt"
) VALUES (
  'phase2-template-photography', 'WEWED_PHASE2_TEST_PHOTOGRAPHY', 'Wewed Standard Photography Agreement',
  'Photography', '1.0.0', repeat('b', 64), 'internal_review', now()
);

INSERT INTO public."ContractTemplateClause" (
  "id", "templateId", "clauseId", "position", "required"
) VALUES ('phase2-template-clause', 'phase2-template-photography', 'phase2-clause-scope', 1, true);

DO $$
DECLARE
  first_number text;
  second_number text;
BEGIN
  SELECT public.next_wewed_contract_number() INTO first_number;
  SELECT public.next_wewed_contract_number() INTO second_number;
  IF first_number = second_number THEN
    RAISE EXCEPTION 'Contract number allocator returned a duplicate';
  END IF;
  IF first_number !~ '^WW-CON-[0-9]{4}-[0-9]{6}$' OR second_number !~ '^WW-CON-[0-9]{4}-[0-9]{6}$' THEN
    RAISE EXCEPTION 'Contract number allocator returned an invalid format';
  END IF;
END $$;

INSERT INTO public."Contract" (
  "id", "contractNumber", "serviceEngagementId", "weddingId", "templateId", "title", "createdById", "updatedAt"
) VALUES (
  'phase2-contract-a', public.next_wewed_contract_number(), 'phase2-engagement-a', 'phase2-wedding-a',
  'phase2-template-photography', 'Wewed Standard Photography Agreement', 'phase2-test-actor', now()
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public."Contract" (
      "id", "contractNumber", "serviceEngagementId", "weddingId", "templateId", "title", "updatedAt"
    ) VALUES (
      'phase2-contract-cross-wedding', public.next_wewed_contract_number(), 'phase2-engagement-a',
      'phase2-wedding-b', 'phase2-template-photography', 'Wrong wedding contract', now()
    );
    RAISE EXCEPTION 'Cross-wedding contract insert unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

INSERT INTO public."ContractVersion" (
  "id", "contractId", "weddingId", "versionNumber", "status", "templateSemanticVersion",
  "canonicalJson", "renderedHtml", "createdById", "updatedAt"
) VALUES (
  'phase2-version-a', 'phase2-contract-a', 'phase2-wedding-a', 1, 'DRAFT', '1.0.0',
  '{"contractNumber":"phase2"}', '<html><body>Phase 2</body></html>', 'phase2-test-actor', now()
);

UPDATE public."ContractVersion"
SET "status" = 'ISSUED',
    "contentSha256" = repeat('c', 64),
    "artifactVaultObjectId" = 'phase2-vault-artifact',
    "artifactSha256" = repeat('d', 64),
    "issuedAt" = now(),
    "updatedAt" = now()
WHERE "id" = 'phase2-version-a';

DO $$
BEGIN
  BEGIN
    UPDATE public."ContractVersion"
    SET "canonicalJson" = '{"tampered":true}', "updatedAt" = now()
    WHERE "id" = 'phase2-version-a';
    RAISE EXCEPTION 'Issued contract version content mutation unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Issued contract version content mutation unexpectedly succeeded' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM public."ContractVersion" WHERE "id" = 'phase2-version-a';
    RAISE EXCEPTION 'Issued contract version delete unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Issued contract version delete unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO public."ContractReviewGrant" (
  "id", "contractId", "contractVersionId", "engagementPartyId", "role", "tokenHash", "expiresAt"
) VALUES (
  'phase2-grant-a', 'phase2-contract-a', 'phase2-version-a', 'phase2-party-vendor',
  'SERVICE_PROVIDER', repeat('e', 64), now() + interval '7 days'
);

DO $$
DECLARE
  plain_token_column_count integer;
BEGIN
  SELECT count(*) INTO plain_token_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'ContractReviewGrant'
    AND lower(column_name) IN ('token', 'plaintexttoken', 'rawtoken');
  IF plain_token_column_count <> 0 THEN
    RAISE EXCEPTION 'Contract review grants must not persist plaintext tokens';
  END IF;
END $$;

INSERT INTO public."ContractEvent" ("id", "contractId", "versionId", "eventType", "actorId", "metadata")
VALUES ('phase2-event-a', 'phase2-contract-a', 'phase2-version-a', 'version_issued', 'phase2-test-actor', '{"channel":"IN_APP"}');

DO $$
BEGIN
  BEGIN
    UPDATE public."ContractEvent" SET "eventType" = 'tampered' WHERE "id" = 'phase2-event-a';
    RAISE EXCEPTION 'Contract event update unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Contract event update unexpectedly succeeded' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM public."ContractEvent" WHERE "id" = 'phase2-event-a';
    RAISE EXCEPTION 'Contract event delete unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Contract event delete unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

DO $$
DECLARE
  issued_count integer;
  grant_count integer;
BEGIN
  SELECT count(*) INTO issued_count
  FROM public."ContractVersion"
  WHERE "id" = 'phase2-version-a' AND "status" = 'ISSUED' AND "issuedAt" IS NOT NULL;
  IF issued_count <> 1 THEN RAISE EXCEPTION 'Issued version invariant failed'; END IF;

  SELECT count(*) INTO grant_count
  FROM public."ContractReviewGrant"
  WHERE "contractVersionId" = 'phase2-version-a' AND char_length("tokenHash") = 64;
  IF grant_count <> 1 THEN RAISE EXCEPTION 'Hashed review grant invariant failed'; END IF;
END $$;

ROLLBACK;

\echo 'Phase 2 contract domain PostgreSQL integration: PASS'
