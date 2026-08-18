\set ON_ERROR_STOP on

DO $$
DECLARE missing text; leaked bigint;
BEGIN
  SELECT string_agg(expected, ', ') INTO missing
  FROM (VALUES ('MediaAsset'),('MediaDerivative'),('MediaBackfillRecord'),('WeddingArchive'),('ArchiveEvent')) AS required(expected)
  WHERE to_regclass(format('wewed_media.%I', required.expected)) IS NULL;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing Phase 5 tables: %', missing; END IF;

  SELECT count(*) INTO leaked
  FROM information_schema.role_table_grants
  WHERE table_schema='wewed_media'
    AND table_name IN ('MediaAsset','MediaDerivative','MediaBackfillRecord','WeddingArchive','ArchiveEvent')
    AND grantee IN ('PUBLIC','anon','authenticated');
  IF leaked <> 0 THEN RAISE EXCEPTION 'Client/browser roles have direct Phase 5 table grants: %', leaked; END IF;
END $$;

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(expected, ', ') INTO missing
  FROM (VALUES
    ('MediaAsset_validation_guard'),
    ('MediaDerivative_validation_guard'),
    ('WeddingArchive_transition_guard'),
    ('ArchiveEvent_append_only_guard'),
    ('VaultObject_media_preservation_guard'),
    ('VaultObject_evidence_hold_guard')
  ) AS required(expected)
  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname=required.expected AND NOT tgisinternal);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing Phase 5/hold triggers: %', missing; END IF;
END $$;

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(expected, ', ') INTO missing
  FROM (VALUES
    ('MediaAsset_wedding_publication_idx'),
    ('MediaAsset_original_vault_wedding_idx'),
    ('MediaAsset_provenance_idx'),
    ('MediaDerivative_asset_wedding_idx'),
    ('MediaDerivative_vault_wedding_idx'),
    ('MediaBackfillRecord_wedding_status_idx'),
    ('MediaBackfillRecord_vault_wedding_idx'),
    ('WeddingArchive_lifecycle_idx'),
    ('ArchiveEvent_wedding_created_idx')
  ) AS required(expected)
  WHERE NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='wewed_media' AND indexname=required.expected);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing Phase 5 indexes: %', missing; END IF;
END $$;

BEGIN;

INSERT INTO public."Couple" ("id", "slug", "partner1", "partner2", "updatedAt")
VALUES ('phase5-couple-a','phase5-couple-a','Media','Couple',now()),
       ('phase5-couple-b','phase5-couple-b','Other','Couple',now());

INSERT INTO public."Wedding" ("id", "slug", "title", "date", "venue", "venueCity", "venueCountry", "coupleId", "updatedAt")
VALUES ('phase5-wedding-a','phase5-wedding-a','Phase 5 Wedding',now()+interval '60 days','Venue A','Harare','Zimbabwe','phase5-couple-a',now()),
       ('phase5-wedding-b','phase5-wedding-b','Other Wedding',now()+interval '90 days','Venue B','Bulawayo','Zimbabwe','phase5-couple-b',now());

INSERT INTO public."MediaItem" ("id","type","url","thumbnailUrl","caption","moment","weddingId","updatedAt")
VALUES ('phase5-media-a','photo','https://legacy.example/a.jpg',NULL,'Legacy A','candid','phase5-wedding-a',now()),
       ('phase5-media-b','photo','https://legacy.example/b.jpg',NULL,'Legacy B','candid','phase5-wedding-b',now());

INSERT INTO public."VaultObject" (
  "id","storageProvider","objectKey","originalFilename","displayName","mimeType","extension","byteSize","checksumSha256",
  "uploadSource","storageState","scanState","weddingId","updatedAt"
) VALUES
 ('phase5-vault-a','supabase','phase5/a.jpg','a.jpg','a.jpg','image/jpeg','jpg',100,repeat('a',64),'phase5_test','stored_private','content_validated','phase5-wedding-a',now()),
 ('phase5-vault-a2','supabase','phase5/a2.jpg','a2.jpg','a2.jpg','image/jpeg','jpg',100,repeat('b',64),'phase5_test','stored_private','content_validated','phase5-wedding-a',now()),
 ('phase5-vault-b','supabase','phase5/b.jpg','b.jpg','b.jpg','image/jpeg','jpg',100,repeat('c',64),'phase5_test','stored_private','content_validated','phase5-wedding-b',now()),
 ('phase5-vault-pending','supabase','phase5/pending.jpg','pending.jpg','pending.jpg','image/jpeg','jpg',100,repeat('d',64),'phase5_test','quarantined','external_scan_required','phase5-wedding-a',now());

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_media."MediaAsset" (
      "id","weddingId","mediaItemId","originalVaultObjectId","provenanceState","sourceType","publicationState","privacyState","rightsState","moderationState"
    ) VALUES ('phase5-cross','phase5-wedding-a','phase5-media-a','phase5-vault-b','VAULT_MANAGED','COUPLE','PRIVATE','WEDDING_MEMBERS','DECLARED_AUTHORIZED','NOT_REQUIRED');
    RAISE EXCEPTION 'Cross-wedding media/Vault binding unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation OR raise_exception THEN
    IF SQLERRM = 'Cross-wedding media/Vault binding unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_media."MediaAsset" (
      "id","weddingId","mediaItemId","originalVaultObjectId","provenanceState","sourceType","publicationState","privacyState","rightsState","moderationState"
    ) VALUES ('phase5-public-private','phase5-wedding-a','phase5-media-a','phase5-vault-a','VAULT_MANAGED','COUPLE','PUBLISHED','WEDDING_MEMBERS','DECLARED_AUTHORIZED','NOT_REQUIRED');
    RAISE EXCEPTION 'Published media with non-public privacy unexpectedly succeeded';
  EXCEPTION WHEN check_violation OR raise_exception THEN
    IF SQLERRM = 'Published media with non-public privacy unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_media."MediaAsset" (
      "id","weddingId","mediaItemId","originalVaultObjectId","provenanceState","sourceType","publicationState","privacyState","rightsState","moderationState"
    ) VALUES ('phase5-public-pending','phase5-wedding-a','phase5-media-a','phase5-vault-pending','VAULT_MANAGED','COUPLE','PUBLISHED','PUBLIC','DECLARED_AUTHORIZED','NOT_REQUIRED');
    RAISE EXCEPTION 'Unvalidated Vault media unexpectedly published';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Unvalidated Vault media unexpectedly published' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO wewed_media."MediaAsset" (
  "id","weddingId","mediaItemId","originalVaultObjectId","provenanceState","sourceType","sourceActorId","ingestedAt",
  "publicationState","privacyState","rightsState","moderationState"
) VALUES (
  'phase5-asset-a','phase5-wedding-a','phase5-media-a','phase5-vault-a','VAULT_MANAGED','COUPLE','phase5-actor',now(),
  'PRIVATE','WEDDING_MEMBERS','DECLARED_AUTHORIZED','NOT_REQUIRED'
);

DO $$
BEGIN
  BEGIN
    UPDATE wewed_media."MediaAsset" SET "originalVaultObjectId"='phase5-vault-a2' WHERE "id"='phase5-asset-a';
    RAISE EXCEPTION 'Governed media original was silently replaceable';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Governed media original was silently replaceable' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    DELETE FROM public."VaultObject" WHERE "id"='phase5-vault-a';
    RAISE EXCEPTION 'Governed media Vault object was hard-deletable';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Governed media Vault object was hard-deletable' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO wewed_contracts."EvidenceHold" (
  "id","weddingId","vaultObjectId","reason","status","placedById"
) VALUES ('phase5-hold-a','phase5-wedding-a','phase5-vault-a','Preserve wedding media during dispute','ACTIVE','phase5-actor');

DO $$
BEGIN
  BEGIN
    UPDATE wewed_media."MediaAsset"
    SET "publicationState"='UNPUBLISHED', "privacyState"='PRIVATE', "archiveState"='ARCHIVED', "archivedAt"=now()
    WHERE "id"='phase5-asset-a';
    RAISE EXCEPTION 'Held media unexpectedly archived';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Held media unexpectedly archived' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO wewed_media."WeddingArchive" ("weddingId","lifecycleState") VALUES ('phase5-wedding-a','ACTIVE_PLANNING');
UPDATE wewed_media."WeddingArchive" SET "lifecycleState"='LIVE_EVENT' WHERE "weddingId"='phase5-wedding-a';

DO $$
BEGIN
  BEGIN
    UPDATE wewed_media."WeddingArchive" SET "lifecycleState"='ARCHIVED' WHERE "weddingId"='phase5-wedding-a';
    RAISE EXCEPTION 'Archive lifecycle unexpectedly skipped POST_WEDDING';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Archive lifecycle unexpectedly skipped POST_WEDDING' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE wewed_media."WeddingArchive" SET "lifecycleState"='ACTIVE_PLANNING' WHERE "weddingId"='phase5-wedding-a';
    RAISE EXCEPTION 'Archive lifecycle unexpectedly regressed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Archive lifecycle unexpectedly regressed' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO wewed_media."ArchiveEvent" ("id","weddingId","eventType","actorId")
VALUES ('phase5-event-a','phase5-wedding-a','EXPORT_REQUESTED','phase5-actor');
DO $$
BEGIN
  BEGIN
    UPDATE wewed_media."ArchiveEvent" SET "actorId"='someone-else' WHERE "id"='phase5-event-a';
    RAISE EXCEPTION 'Archive event unexpectedly mutable';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Archive event unexpectedly mutable' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO wewed_media."MediaBackfillRecord" ("id","weddingId","mediaItemId","sourceUrl","status")
VALUES ('phase5-backfill-b','phase5-wedding-b','phase5-media-b','https://legacy.example/b.jpg','DISCOVERED');

DO $$
DECLARE state text; vault_id text;
BEGIN
  SELECT "status","vaultObjectId" INTO state,vault_id FROM wewed_media."MediaBackfillRecord" WHERE "id"='phase5-backfill-b';
  IF state <> 'DISCOVERED' OR vault_id IS NOT NULL THEN RAISE EXCEPTION 'Backfill discovery fabricated ingestion evidence'; END IF;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE wewed_media."MediaBackfillRecord" SET "status"='INGESTED' WHERE "id"='phase5-backfill-b';
    RAISE EXCEPTION 'Backfill could claim INGESTED without Vault evidence';
  EXCEPTION WHEN check_violation OR raise_exception THEN
    IF SQLERRM = 'Backfill could claim INGESTED without Vault evidence' THEN RAISE; END IF;
  END;
END $$;

ROLLBACK;

SELECT 'Phase 5 wedding media archive PostgreSQL integration passed' AS result;
