-- Wewed AI workspace storage uses existing governed application tables.
-- These indexes accelerate version/draft/proposal listings and document retrieval.

CREATE INDEX IF NOT EXISTS "ContentRevision_ai_workspace_idx"
ON public."ContentRevision" ("weddingId", section, status, "createdAt" DESC)
WHERE section IN ('ai_template_version', 'ai_communication_draft', 'ai_action_proposal');

CREATE INDEX IF NOT EXISTS "WeddingContent_ai_document_lookup_idx"
ON public."WeddingContent" ("weddingId", section, field)
WHERE section IN ('ai_document', 'ai_document_chunk');

CREATE INDEX IF NOT EXISTS "WeddingContent_ai_document_search_idx"
ON public."WeddingContent"
USING GIN (to_tsvector('simple', COALESCE(value, '')))
WHERE section = 'ai_document_chunk';
