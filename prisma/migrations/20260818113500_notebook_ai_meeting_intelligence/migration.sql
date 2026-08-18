-- WW-NOTEBOOK-AI-2026-08-18-01
-- First-party Notebook domain. Intentionally server-only: no anon/authenticated grants.

CREATE SCHEMA IF NOT EXISTS wewed_notebook;
REVOKE ALL ON SCHEMA wewed_notebook FROM PUBLIC;

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookNote" (
  id TEXT PRIMARY KEY,
  "ownerUserId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  "weddingId" TEXT NULL REFERENCES public."Wedding"(id) ON DELETE CASCADE,
  "adminAccountId" TEXT NULL,
  "contextType" TEXT NOT NULL DEFAULT 'personal',
  title TEXT NOT NULL DEFAULT 'Untitled note',
  "contentJson" JSONB NOT NULL DEFAULT '{"format":"markdown","value":""}'::jsonb,
  "contentText" TEXT NOT NULL DEFAULT '',
  "noteType" TEXT NOT NULL DEFAULT 'GENERAL',
  visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  "isPinned" BOOLEAN NOT NULL DEFAULT FALSE,
  "archivedAt" TIMESTAMPTZ NULL,
  "deletedAt" TIMESTAMPTZ NULL,
  version INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotebookNote_version_positive" CHECK (version > 0),
  CONSTRAINT "NotebookNote_visibility_valid" CHECK (visibility IN ('PRIVATE','WEDDING_TEAM','SELECTED_USERS','ADMIN_INTERNAL','SHARED')),
  CONSTRAINT "NotebookNote_type_valid" CHECK ("noteType" IN ('GENERAL','MEETING','VOICE','QUICK'))
);

CREATE INDEX IF NOT EXISTS "NotebookNote_owner_updated_idx" ON wewed_notebook."NotebookNote" ("ownerUserId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "NotebookNote_wedding_updated_idx" ON wewed_notebook."NotebookNote" ("weddingId", "updatedAt" DESC) WHERE "weddingId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "NotebookNote_admin_updated_idx" ON wewed_notebook."NotebookNote" ("adminAccountId", "updatedAt" DESC) WHERE "adminAccountId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "NotebookNote_visibility_idx" ON wewed_notebook."NotebookNote" (visibility);
CREATE INDEX IF NOT EXISTS "NotebookNote_live_idx" ON wewed_notebook."NotebookNote" ("deletedAt", "archivedAt");
CREATE INDEX IF NOT EXISTS "NotebookNote_search_idx" ON wewed_notebook."NotebookNote" USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce("contentText",'')));

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookNoteVersion" (
  id TEXT PRIMARY KEY,
  "noteId" TEXT NOT NULL REFERENCES wewed_notebook."NotebookNote"(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  "contentJson" JSONB NOT NULL,
  "contentText" TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'USER',
  "createdByUserId" TEXT NOT NULL,
  "providerName" TEXT NULL,
  "modelName" TEXT NULL,
  "promptVersion" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotebookNoteVersion_source_valid" CHECK (source IN ('USER','AI','RESTORE','SYSTEM')),
  UNIQUE ("noteId", version)
);
CREATE INDEX IF NOT EXISTS "NotebookNoteVersion_note_idx" ON wewed_notebook."NotebookNoteVersion" ("noteId", version DESC);

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookShare" (
  id TEXT PRIMARY KEY,
  "noteId" TEXT NOT NULL REFERENCES wewed_notebook."NotebookNote"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'VIEWER',
  "createdByUserId" TEXT NOT NULL,
  "revokedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotebookShare_role_valid" CHECK (role IN ('VIEWER','EDITOR')),
  UNIQUE ("noteId", "userId")
);
CREATE INDEX IF NOT EXISTS "NotebookShare_user_idx" ON wewed_notebook."NotebookShare" ("userId", "revokedAt");

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookEntityLink" (
  id TEXT PRIMARY KEY,
  "noteId" TEXT NOT NULL REFERENCES wewed_notebook."NotebookNote"(id) ON DELETE CASCADE,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "labelSnapshot" TEXT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("noteId", "entityType", "entityId")
);
CREATE INDEX IF NOT EXISTS "NotebookEntityLink_entity_idx" ON wewed_notebook."NotebookEntityLink" ("entityType", "entityId");

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookAttachment" (
  id TEXT PRIMARY KEY,
  "noteId" TEXT NOT NULL REFERENCES wewed_notebook."NotebookNote"(id) ON DELETE CASCADE,
  "storageBucket" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'READY',
  "createdByUserId" TEXT NOT NULL,
  "deletedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("storageBucket", "storageKey")
);
CREATE INDEX IF NOT EXISTS "NotebookAttachment_note_idx" ON wewed_notebook."NotebookAttachment" ("noteId", "deletedAt");

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookRecording" (
  id TEXT PRIMARY KEY,
  "noteId" TEXT NOT NULL REFERENCES wewed_notebook."NotebookNote"(id) ON DELETE CASCADE,
  "storageBucket" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "durationMs" INTEGER NULL,
  status TEXT NOT NULL DEFAULT 'READY',
  "transcriptionProvider" TEXT NULL,
  "transcriptionJobId" TEXT NULL,
  "errorCode" TEXT NULL,
  "errorMessage" TEXT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotebookRecording_status_valid" CHECK (status IN ('UPLOADING','READY','TRANSCRIBING','TRANSCRIBED','FAILED')),
  UNIQUE ("storageBucket", "storageKey")
);
CREATE INDEX IF NOT EXISTS "NotebookRecording_note_idx" ON wewed_notebook."NotebookRecording" ("noteId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookTranscript" (
  id TEXT PRIMARY KEY,
  "recordingId" TEXT NOT NULL UNIQUE REFERENCES wewed_notebook."NotebookRecording"(id) ON DELETE CASCADE,
  "noteId" TEXT NOT NULL REFERENCES wewed_notebook."NotebookNote"(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT NULL,
  confidence DOUBLE PRECISION NULL,
  provider TEXT NULL,
  "providerJobId" TEXT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  "updatedByUserId" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NotebookTranscript_note_idx" ON wewed_notebook."NotebookTranscript" ("noteId", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookAiDerivation" (
  id TEXT PRIMARY KEY,
  "noteId" TEXT NOT NULL REFERENCES wewed_notebook."NotebookNote"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  "sourceVersion" INTEGER NOT NULL,
  output JSONB NOT NULL,
  provider TEXT NULL,
  model TEXT NULL,
  "promptVersion" TEXT NOT NULL,
  stale BOOLEAN NOT NULL DEFAULT FALSE,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NotebookAiDerivation_note_idx" ON wewed_notebook."NotebookAiDerivation" ("noteId", "sourceVersion", stale);

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookSuggestion" (
  id TEXT PRIMARY KEY,
  "noteId" TEXT NOT NULL REFERENCES wewed_notebook."NotebookNote"(id) ON DELETE CASCADE,
  "sourceVersion" INTEGER NOT NULL,
  "targetType" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  payload JSONB NOT NULL,
  rationale TEXT NULL,
  evidence TEXT NULL,
  confidence DOUBLE PRECISION NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "reviewedByUserId" TEXT NULL,
  "reviewedAt" TIMESTAMPTZ NULL,
  "appliedAt" TIMESTAMPTZ NULL,
  "resultJson" JSONB NULL,
  "failureCode" TEXT NULL,
  "failureMessage" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotebookSuggestion_status_valid" CHECK (status IN ('PENDING','APPROVED','REJECTED','APPLIED','FAILED','STALE'))
);
CREATE INDEX IF NOT EXISTS "NotebookSuggestion_note_idx" ON wewed_notebook."NotebookSuggestion" ("noteId", status, "createdAt" DESC);

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookActionReceipt" (
  id TEXT PRIMARY KEY,
  "suggestionId" TEXT NOT NULL UNIQUE REFERENCES wewed_notebook."NotebookSuggestion"(id) ON DELETE CASCADE,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NULL,
  "actorUserId" TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wewed_notebook."NotebookAuditEvent" (
  id TEXT PRIMARY KEY,
  "noteId" TEXT NULL REFERENCES wewed_notebook."NotebookNote"(id) ON DELETE SET NULL,
  "actorUserId" TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NotebookAuditEvent_note_idx" ON wewed_notebook."NotebookAuditEvent" ("noteId", "createdAt" DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA wewed_notebook FROM anon';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA wewed_notebook FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA wewed_notebook FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA wewed_notebook FROM authenticated';
  END IF;
END $$;

COMMENT ON SCHEMA wewed_notebook IS 'Private Wewed Notebook domain governed by WW-NOTEBOOK-AI-2026-08-18-01';