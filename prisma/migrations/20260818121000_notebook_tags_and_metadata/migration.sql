-- WW-NOTEBOOK-AI-2026-08-18-01 — first-class note tags
ALTER TABLE wewed_notebook."NotebookNote"
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS "NotebookNote_tags_idx"
  ON wewed_notebook."NotebookNote" USING GIN (tags);

ALTER TABLE wewed_notebook."NotebookNote"
  ADD CONSTRAINT "NotebookNote_tags_array"
  CHECK (jsonb_typeof(tags) = 'array');
