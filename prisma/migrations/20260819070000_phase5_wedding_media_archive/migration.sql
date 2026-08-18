-- Phase 5 — Wedding Media Vault & Post-Wedding Archive
-- Media publication is metadata-driven. Vault originals remain private and application-authorized.
-- Legacy URL media is inventoried honestly; this migration never fabricates a successful backfill.

CREATE SCHEMA IF NOT EXISTS wewed_media;

CREATE TABLE wewed_media."MediaAsset" (
  "id" text PRIMARY KEY,
  "weddingId" text NOT NULL,
  "mediaItemId" text NOT NULL UNIQUE,
  "originalVaultObjectId" text,
  "provenanceState" text NOT NULL DEFAULT 'LEGACY_EXTERNAL',
  "sourceType" text NOT NULL DEFAULT 'LEGACY',
  "sourceActorId" text,
  "sourceUrl" text,
  "sourceCapturedAt" timestamp(3),
  "ingestedAt" timestamp(3),
  "publicationState" text NOT NULL DEFAULT 'PRIVATE',
  "privacyState" text NOT NULL DEFAULT 'WEDDING_MEMBERS',
  "rightsState" text NOT NULL DEFAULT 'UNKNOWN',
  "moderationState" text NOT NULL DEFAULT 'NOT_REQUIRED',
  "archiveState" text NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_wedding_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaAsset_media_item_fkey" FOREIGN KEY ("mediaItemId") REFERENCES public."MediaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaAsset_original_vault_wedding_fkey" FOREIGN KEY ("originalVaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaAsset_provenance_check" CHECK ("provenanceState" IN ('VAULT_MANAGED','LEGACY_EXTERNAL','BACKFILL_PENDING','BACKFILL_FAILED')),
  CONSTRAINT "MediaAsset_source_type_check" CHECK ("sourceType" IN ('COUPLE','GUEST','PLANNER','VENDOR','SYSTEM','LEGACY')),
  CONSTRAINT "MediaAsset_publication_check" CHECK ("publicationState" IN ('PRIVATE','PUBLISHED','UNPUBLISHED')),
  CONSTRAINT "MediaAsset_privacy_check" CHECK ("privacyState" IN ('PRIVATE','WEDDING_MEMBERS','INVITED_GUESTS','PUBLIC')),
  CONSTRAINT "MediaAsset_rights_check" CHECK ("rightsState" IN ('UNKNOWN','DECLARED_AUTHORIZED','LICENSED','CONSENTED','RESTRICTED')),
  CONSTRAINT "MediaAsset_moderation_check" CHECK ("moderationState" IN ('PENDING','APPROVED','REJECTED','NOT_REQUIRED')),
  CONSTRAINT "MediaAsset_archive_check" CHECK ("archiveState" IN ('ACTIVE','ARCHIVED')),
  CONSTRAINT "MediaAsset_vault_managed_shape_check" CHECK ("provenanceState" <> 'VAULT_MANAGED' OR "originalVaultObjectId" IS NOT NULL),
  CONSTRAINT "MediaAsset_public_shape_check" CHECK ("publicationState" <> 'PUBLISHED' OR ("privacyState"='PUBLIC' AND "originalVaultObjectId" IS NOT NULL)),
  CONSTRAINT "MediaAsset_archive_shape_check" CHECK (("archiveState"='ACTIVE' AND "archivedAt" IS NULL) OR ("archiveState"='ARCHIVED' AND "archivedAt" IS NOT NULL AND "publicationState" <> 'PUBLISHED')),
  CONSTRAINT "MediaAsset_id_wedding_key" UNIQUE ("id", "weddingId")
);
CREATE INDEX "MediaAsset_wedding_publication_idx" ON wewed_media."MediaAsset" ("weddingId", "publicationState", "privacyState", "archiveState");
CREATE INDEX "MediaAsset_original_vault_wedding_idx" ON wewed_media."MediaAsset" ("originalVaultObjectId", "weddingId");
CREATE INDEX "MediaAsset_provenance_idx" ON wewed_media."MediaAsset" ("weddingId", "provenanceState", "createdAt");

CREATE TABLE wewed_media."MediaDerivative" (
  "id" text PRIMARY KEY,
  "mediaAssetId" text NOT NULL,
  "weddingId" text NOT NULL,
  "vaultObjectId" text NOT NULL,
  "derivativeType" text NOT NULL,
  "status" text NOT NULL DEFAULT 'READY',
  "width" integer,
  "height" integer,
  "durationMs" integer,
  "processor" text NOT NULL DEFAULT 'WEWED_SHARP',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaDerivative_asset_wedding_fkey" FOREIGN KEY ("mediaAssetId", "weddingId") REFERENCES wewed_media."MediaAsset"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaDerivative_vault_wedding_fkey" FOREIGN KEY ("vaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaDerivative_type_check" CHECK ("derivativeType" IN ('THUMBNAIL','WEB_DISPLAY','VIDEO_POSTER')),
  CONSTRAINT "MediaDerivative_status_check" CHECK ("status" IN ('READY','FAILED')),
  CONSTRAINT "MediaDerivative_width_check" CHECK ("width" IS NULL OR "width" > 0),
  CONSTRAINT "MediaDerivative_height_check" CHECK ("height" IS NULL OR "height" > 0),
  CONSTRAINT "MediaDerivative_duration_check" CHECK ("durationMs" IS NULL OR "durationMs" >= 0),
  CONSTRAINT "MediaDerivative_asset_type_key" UNIQUE ("mediaAssetId", "derivativeType")
);
CREATE INDEX "MediaDerivative_asset_wedding_idx" ON wewed_media."MediaDerivative" ("mediaAssetId", "weddingId");
CREATE INDEX "MediaDerivative_vault_wedding_idx" ON wewed_media."MediaDerivative" ("vaultObjectId", "weddingId");

CREATE TABLE wewed_media."MediaBackfillRecord" (
  "id" text PRIMARY KEY,
  "weddingId" text NOT NULL,
  "mediaItemId" text NOT NULL UNIQUE,
  "sourceUrl" text NOT NULL,
  "status" text NOT NULL DEFAULT 'DISCOVERED',
  "vaultObjectId" text,
  "sourceChecksumSha256" text,
  "discoveredAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ingestedAt" timestamp(3),
  "failureReason" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaBackfillRecord_wedding_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaBackfillRecord_media_item_fkey" FOREIGN KEY ("mediaItemId") REFERENCES public."MediaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaBackfillRecord_vault_wedding_fkey" FOREIGN KEY ("vaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaBackfillRecord_status_check" CHECK ("status" IN ('DISCOVERED','INGESTED','FAILED','SKIPPED_RIGHTS','SKIPPED_UNSUPPORTED')),
  CONSTRAINT "MediaBackfillRecord_ingested_shape_check" CHECK ("status" <> 'INGESTED' OR ("vaultObjectId" IS NOT NULL AND "ingestedAt" IS NOT NULL)),
  CONSTRAINT "MediaBackfillRecord_failure_shape_check" CHECK ("status" <> 'FAILED' OR ("failureReason" IS NOT NULL AND char_length(btrim("failureReason")) >= 3))
);
CREATE INDEX "MediaBackfillRecord_wedding_status_idx" ON wewed_media."MediaBackfillRecord" ("weddingId", "status", "discoveredAt");
CREATE INDEX "MediaBackfillRecord_vault_wedding_idx" ON wewed_media."MediaBackfillRecord" ("vaultObjectId", "weddingId");

CREATE TABLE wewed_media."WeddingArchive" (
  "weddingId" text PRIMARY KEY,
  "lifecycleState" text NOT NULL DEFAULT 'ACTIVE_PLANNING',
  "retentionPolicy" text NOT NULL DEFAULT 'POLICY_UNSET',
  "retentionUntil" timestamp(3),
  "exportEnabled" boolean NOT NULL DEFAULT true,
  "archivedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeddingArchive_wedding_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WeddingArchive_lifecycle_check" CHECK ("lifecycleState" IN ('ACTIVE_PLANNING','LIVE_EVENT','POST_WEDDING','ARCHIVED')),
  CONSTRAINT "WeddingArchive_retention_policy_check" CHECK (char_length(btrim("retentionPolicy")) BETWEEN 3 AND 80),
  CONSTRAINT "WeddingArchive_archived_shape_check" CHECK (("lifecycleState"='ARCHIVED' AND "archivedAt" IS NOT NULL) OR ("lifecycleState"<>'ARCHIVED' AND "archivedAt" IS NULL))
);
CREATE INDEX "WeddingArchive_lifecycle_idx" ON wewed_media."WeddingArchive" ("lifecycleState", "updatedAt");

CREATE TABLE wewed_media."ArchiveEvent" (
  "id" text PRIMARY KEY,
  "weddingId" text NOT NULL,
  "eventType" text NOT NULL,
  "actorId" text NOT NULL,
  "fromState" text,
  "toState" text,
  "metadata" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArchiveEvent_wedding_fkey" FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ArchiveEvent_type_check" CHECK ("eventType" IN ('LIFECYCLE_TRANSITION','EXPORT_REQUESTED','MEDIA_ARCHIVED','MEDIA_PUBLISHED','MEDIA_UNPUBLISHED','BACKFILL_RECORDED'))
);
CREATE INDEX "ArchiveEvent_wedding_created_idx" ON wewed_media."ArchiveEvent" ("weddingId", "createdAt", "id");

CREATE OR REPLACE FUNCTION wewed_media.validate_media_asset()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_media AS $$
DECLARE media_wedding text; vault_wedding text; vault_storage text; vault_scan text; vault_deleted timestamp(3); vault_hold boolean;
BEGIN
  SELECT m."weddingId" INTO media_wedding FROM public."MediaItem" m WHERE m."id"=NEW."mediaItemId";
  IF media_wedding IS DISTINCT FROM NEW."weddingId" THEN RAISE EXCEPTION 'Media asset must belong to the same wedding as MediaItem'; END IF;
  IF NEW."originalVaultObjectId" IS NOT NULL THEN
    SELECT v."weddingId", v."storageState", v."scanState", v."deletedAt", v."legalHold" INTO vault_wedding, vault_storage, vault_scan, vault_deleted, vault_hold
    FROM public."VaultObject" v WHERE v."id"=NEW."originalVaultObjectId";
    IF vault_wedding IS DISTINCT FROM NEW."weddingId" THEN RAISE EXCEPTION 'Media original Vault object must belong to the same wedding'; END IF;
  END IF;
  IF NEW."provenanceState"='VAULT_MANAGED' AND NEW."originalVaultObjectId" IS NULL THEN RAISE EXCEPTION 'Vault-managed media requires an original Vault object'; END IF;
  IF NEW."publicationState"='PUBLISHED' THEN
    IF NEW."privacyState"<>'PUBLIC' THEN RAISE EXCEPTION 'Published media requires PUBLIC presentation privacy'; END IF;
    IF NEW."originalVaultObjectId" IS NULL OR vault_storage IS DISTINCT FROM 'stored_private' OR vault_scan IS DISTINCT FROM 'content_validated' OR vault_deleted IS NOT NULL THEN
      RAISE EXCEPTION 'Only validated, private Vault media can be published through Wewed';
    END IF;
    IF NEW."rightsState"='RESTRICTED' OR NEW."moderationState"='REJECTED' THEN RAISE EXCEPTION 'Restricted or rejected media cannot be published'; END IF;
  END IF;
  IF NEW."archiveState"='ARCHIVED' AND COALESCE(vault_hold,false) THEN RAISE EXCEPTION 'Media under an evidence/legal hold cannot be archived'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW."weddingId" IS DISTINCT FROM OLD."weddingId" OR NEW."mediaItemId" IS DISTINCT FROM OLD."mediaItemId" OR NEW."sourceType" IS DISTINCT FROM OLD."sourceType" OR NEW."sourceActorId" IS DISTINCT FROM OLD."sourceActorId" OR NEW."sourceUrl" IS DISTINCT FROM OLD."sourceUrl" THEN
      RAISE EXCEPTION 'Media provenance identity cannot be rewritten';
    END IF;
    IF OLD."provenanceState"='VAULT_MANAGED' AND (NEW."provenanceState" IS DISTINCT FROM OLD."provenanceState" OR NEW."originalVaultObjectId" IS DISTINCT FROM OLD."originalVaultObjectId") THEN
      RAISE EXCEPTION 'A governed media original cannot be silently replaced';
    END IF;
  END IF;
  NEW."updatedAt"=CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "MediaAsset_validation_guard" BEFORE INSERT OR UPDATE ON wewed_media."MediaAsset" FOR EACH ROW EXECUTE FUNCTION wewed_media.validate_media_asset();

CREATE OR REPLACE FUNCTION wewed_media.validate_media_derivative()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_media AS $$
DECLARE asset_wedding text; vault_wedding text;
BEGIN
  SELECT a."weddingId" INTO asset_wedding FROM wewed_media."MediaAsset" a WHERE a."id"=NEW."mediaAssetId";
  SELECT v."weddingId" INTO vault_wedding FROM public."VaultObject" v WHERE v."id"=NEW."vaultObjectId";
  IF asset_wedding IS DISTINCT FROM NEW."weddingId" OR vault_wedding IS DISTINCT FROM NEW."weddingId" THEN
    RAISE EXCEPTION 'Media derivative, asset and Vault object must belong to the same wedding';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "MediaDerivative_validation_guard" BEFORE INSERT OR UPDATE ON wewed_media."MediaDerivative" FOR EACH ROW EXECUTE FUNCTION wewed_media.validate_media_derivative();

CREATE OR REPLACE FUNCTION wewed_media.enforce_archive_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_media AS $$
DECLARE old_rank integer; new_rank integer;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Wedding archive governance records cannot be deleted'; END IF;
  IF NEW."weddingId" IS DISTINCT FROM OLD."weddingId" THEN RAISE EXCEPTION 'Wedding archive identity is immutable'; END IF;
  old_rank=CASE OLD."lifecycleState" WHEN 'ACTIVE_PLANNING' THEN 1 WHEN 'LIVE_EVENT' THEN 2 WHEN 'POST_WEDDING' THEN 3 ELSE 4 END;
  new_rank=CASE NEW."lifecycleState" WHEN 'ACTIVE_PLANNING' THEN 1 WHEN 'LIVE_EVENT' THEN 2 WHEN 'POST_WEDDING' THEN 3 ELSE 4 END;
  IF new_rank < old_rank OR new_rank > old_rank + 1 THEN RAISE EXCEPTION 'Wedding archive lifecycle must move forward one governed state at a time'; END IF;
  NEW."archivedAt"=CASE WHEN NEW."lifecycleState"='ARCHIVED' THEN COALESCE(OLD."archivedAt", CURRENT_TIMESTAMP) ELSE NULL END;
  NEW."updatedAt"=CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "WeddingArchive_transition_guard" BEFORE UPDATE OR DELETE ON wewed_media."WeddingArchive" FOR EACH ROW EXECUTE FUNCTION wewed_media.enforce_archive_transition();

CREATE OR REPLACE FUNCTION wewed_media.enforce_archive_event_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_media AS $$
BEGIN RAISE EXCEPTION 'Wedding archive events are append-only'; END;
$$;
CREATE TRIGGER "ArchiveEvent_append_only_guard" BEFORE UPDATE OR DELETE ON wewed_media."ArchiveEvent" FOR EACH ROW EXECUTE FUNCTION wewed_media.enforce_archive_event_append_only();

CREATE OR REPLACE FUNCTION wewed_media.enforce_media_vault_preservation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog, public, wewed_media AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM wewed_media."MediaAsset" a WHERE a."originalVaultObjectId"=OLD."id"
    UNION ALL
    SELECT 1 FROM wewed_media."MediaDerivative" d WHERE d."vaultObjectId"=OLD."id"
    LIMIT 1
  ) THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Governed wedding media Vault objects cannot be hard-deleted'; END IF;
    IF NEW."weddingId" IS DISTINCT FROM OLD."weddingId" OR NEW."storageProvider" IS DISTINCT FROM OLD."storageProvider" OR NEW."objectKey" IS DISTINCT FROM OLD."objectKey" OR NEW."mimeType" IS DISTINCT FROM OLD."mimeType" OR NEW."byteSize" IS DISTINCT FROM OLD."byteSize" OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256" OR NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
      RAISE EXCEPTION 'Governed wedding media binaries cannot be destructively rewritten';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "VaultObject_media_preservation_guard" BEFORE UPDATE OR DELETE ON public."VaultObject" FOR EACH ROW EXECUTE FUNCTION wewed_media.enforce_media_vault_preservation();

-- Inventory current URL-based media without claiming that Wewed has copied the binary.
INSERT INTO wewed_media."MediaBackfillRecord" ("id", "weddingId", "mediaItemId", "sourceUrl", "status")
SELECT 'backfill-' || m."id", m."weddingId", m."id", m."url", 'DISCOVERED'
FROM public."MediaItem" m
WHERE m."url" IS NOT NULL AND m."url" NOT LIKE '/api/media/%'
ON CONFLICT ("mediaItemId") DO NOTHING;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_media FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA wewed_media FROM PUBLIC;
DO $phase5_private_roles$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wewed_media FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_media FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA wewed_media FROM %I', role_name);
    END IF;
  END LOOP;
END
$phase5_private_roles$;
