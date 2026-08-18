-- Phase 1 — Vault Core + Communications Attachments
-- Additive only. Communications remain in the private wewed_communications schema.
-- VaultObject remains the canonical stored binary metadata record.

CREATE TABLE wewed_communications."CommunicationAttachment" (
  "id" text PRIMARY KEY,
  "messageId" text NOT NULL,
  "conversationId" text NOT NULL,
  "vaultObjectId" text NOT NULL,
  "weddingId" text NOT NULL,
  "caption" text,
  "position" integer NOT NULL DEFAULT 0 CHECK ("position" >= 0),
  "createdByUserId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES wewed_communications."CommunicationMessage"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationAttachment_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES wewed_communications."CommunicationConversation"("id") ON DELETE CASCADE,
  CONSTRAINT "CommunicationAttachment_vaultObject_wedding_fkey"
    FOREIGN KEY ("vaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommunicationAttachment_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE SET NULL,
  CONSTRAINT "CommunicationAttachment_message_vault_key" UNIQUE ("messageId", "vaultObjectId")
);

CREATE INDEX "CommunicationAttachment_conversation_created_idx"
  ON wewed_communications."CommunicationAttachment" ("conversationId", "createdAt", "id");
CREATE INDEX "CommunicationAttachment_vaultObject_idx"
  ON wewed_communications."CommunicationAttachment" ("vaultObjectId");
CREATE INDEX "CommunicationAttachment_wedding_idx"
  ON wewed_communications."CommunicationAttachment" ("weddingId", "createdAt" DESC);

-- Prevent a caller from attaching a Vault object to a message in another conversation.
CREATE OR REPLACE FUNCTION wewed_communications.enforce_communication_attachment_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  message_conversation_id text;
  conversation_wedding_id text;
BEGIN
  SELECT "conversationId" INTO message_conversation_id
  FROM wewed_communications."CommunicationMessage"
  WHERE "id" = NEW."messageId";

  IF message_conversation_id IS NULL OR message_conversation_id <> NEW."conversationId" THEN
    RAISE EXCEPTION 'Communication attachment message/conversation mismatch';
  END IF;

  SELECT "weddingId" INTO conversation_wedding_id
  FROM wewed_communications."CommunicationConversation"
  WHERE "id" = NEW."conversationId";

  IF conversation_wedding_id IS NULL THEN
    RAISE EXCEPTION 'Communication attachments require wedding context';
  END IF;

  IF conversation_wedding_id <> NEW."weddingId" THEN
    RAISE EXCEPTION 'Communication attachment wedding mismatch';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION wewed_communications.enforce_communication_attachment_context()
  SET search_path TO wewed_communications, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION
  wewed_communications.enforce_communication_attachment_context()
FROM PUBLIC;

CREATE TRIGGER "CommunicationAttachment_context_guard"
BEFORE INSERT OR UPDATE ON wewed_communications."CommunicationAttachment"
FOR EACH ROW EXECUTE FUNCTION wewed_communications.enforce_communication_attachment_context();

-- Notebook already has a private attachment table. Phase 1 keeps it as a compatibility
-- index while allowing every new Notebook attachment to point at the canonical Vault object.
ALTER TABLE wewed_notebook."NotebookAttachment"
  ADD COLUMN IF NOT EXISTS "vaultObjectId" text;

ALTER TABLE wewed_notebook."NotebookAttachment"
  ADD CONSTRAINT "NotebookAttachment_vaultObjectId_fkey"
  FOREIGN KEY ("vaultObjectId") REFERENCES public."VaultObject"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "NotebookAttachment_vaultObjectId_idx"
  ON wewed_notebook."NotebookAttachment" ("vaultObjectId");

-- Defense in depth: browser roles never receive direct table access or direct trigger-function execution.
REVOKE ALL PRIVILEGES ON wewed_communications."CommunicationAttachment" FROM PUBLIC;
DO $phase1_private_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON wewed_communications."CommunicationAttachment" FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION wewed_communications.enforce_communication_attachment_context() FROM %I', role_name);
    END IF;
  END LOOP;
END
$phase1_private_roles$;
