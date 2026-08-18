\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF to_regclass('wewed_communications."CommunicationAttachment"') IS NULL THEN
    RAISE EXCEPTION 'CommunicationAttachment private table is missing';
  END IF;
  IF to_regclass('public."VaultObject"') IS NULL OR to_regclass('public."VaultLink"') IS NULL THEN
    RAISE EXCEPTION 'Vault foundation tables are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'wewed_notebook'
      AND table_name = 'NotebookAttachment'
      AND column_name = 'vaultObjectId'
  ) THEN
    RAISE EXCEPTION 'NotebookAttachment.vaultObjectId compatibility pointer is missing';
  END IF;
END
$$;

DO $$
DECLARE
  exposed integer;
BEGIN
  SELECT count(*) INTO exposed
  FROM information_schema.role_table_grants
  WHERE table_schema = 'wewed_communications'
    AND table_name = 'CommunicationAttachment'
    AND grantee IN ('PUBLIC', 'anon', 'authenticated');
  IF exposed <> 0 THEN
    RAISE EXCEPTION 'CommunicationAttachment unexpectedly grants browser/public table access';
  END IF;
END
$$;

INSERT INTO public."Couple" ("id", "slug", "partner1", "partner2", "createdAt", "updatedAt")
VALUES
  ('vault-phase1-couple-a', 'vault-phase1-a', 'A', 'B', now(), now()),
  ('vault-phase1-couple-b', 'vault-phase1-b', 'C', 'D', now(), now());

INSERT INTO public."Wedding"
  ("id", "slug", "title", "date", "venue", "venueCity", "venueCountry", "coupleId", "createdAt", "updatedAt")
VALUES
  ('vault-phase1-wedding-a', 'vault-phase1-wedding-a', 'Vault Wedding A', now() + interval '20 days', 'A Venue', 'Harare', 'Zimbabwe', 'vault-phase1-couple-a', now(), now()),
  ('vault-phase1-wedding-b', 'vault-phase1-wedding-b', 'Vault Wedding B', now() + interval '40 days', 'B Venue', 'Bulawayo', 'Zimbabwe', 'vault-phase1-couple-b', now(), now());

INSERT INTO public."User"
  ("id", "email", "name", "role", "coupleId", "currentWeddingId", "isActive", "createdAt", "updatedAt")
VALUES
  ('vault-phase1-user-a', 'vault-phase1-a@example.test', 'Vault User A', 'couple', 'vault-phase1-couple-a', 'vault-phase1-wedding-a', true, now(), now()),
  ('vault-phase1-user-b', 'vault-phase1-b@example.test', 'Vault User B', 'couple', 'vault-phase1-couple-b', 'vault-phase1-wedding-b', true, now(), now());

INSERT INTO wewed_communications."CommunicationConversation"
  ("id", "kind", "type", "title", "weddingId", "createdByUserId", "status", "createdAt", "updatedAt")
VALUES
  ('vault-phase1-conversation-a', 'DIRECT', 'PLANNER_CLIENT', 'A', 'vault-phase1-wedding-a', 'vault-phase1-user-a', 'OPEN', now(), now()),
  ('vault-phase1-conversation-a2', 'DIRECT', 'PLANNER_CLIENT', 'A2', 'vault-phase1-wedding-a', 'vault-phase1-user-a', 'OPEN', now(), now()),
  ('vault-phase1-conversation-null', 'DIRECT', 'SUPPORT', 'No wedding', NULL, 'vault-phase1-user-a', 'OPEN', now(), now());

INSERT INTO wewed_communications."CommunicationMessage"
  ("id", "conversationId", "senderUserId", "messageType", "visibility", "body", "createdAt", "updatedAt")
VALUES
  ('vault-phase1-message-a', 'vault-phase1-conversation-a', 'vault-phase1-user-a', 'USER', 'PARTICIPANTS', 'Attachment A', now(), now()),
  ('vault-phase1-message-a2', 'vault-phase1-conversation-a2', 'vault-phase1-user-a', 'USER', 'PARTICIPANTS', 'Attachment A2', now(), now()),
  ('vault-phase1-message-null', 'vault-phase1-conversation-null', 'vault-phase1-user-a', 'USER', 'PARTICIPANTS', 'No wedding attachment', now(), now()),
  ('vault-phase1-message-retained', 'vault-phase1-conversation-a', 'vault-phase1-user-a', 'USER', 'PARTICIPANTS', 'Retained evidence', now(), now());

INSERT INTO public."VaultObject"
  ("id", "storageProvider", "objectKey", "originalFilename", "displayName", "mimeType", "extension", "byteSize", "checksumSha256", "uploaderActorId", "uploadSource", "storageState", "scanState", "retentionClass", "legalHold", "sensitivity", "publicationState", "metadata", "weddingId", "createdAt", "updatedAt")
VALUES
  ('vault-phase1-object-a', 'supabase', 'phase1/a.pdf', 'a.pdf', 'a.pdf', 'application/pdf', 'pdf', 10, repeat('a',64), 'vault-phase1-user-a', 'communication_attachment', 'stored_private', 'content_validated', 'wedding_record', false, 'private', 'private', '{}', 'vault-phase1-wedding-a', now(), now()),
  ('vault-phase1-object-b', 'supabase', 'phase1/b.pdf', 'b.pdf', 'b.pdf', 'application/pdf', 'pdf', 10, repeat('b',64), 'vault-phase1-user-b', 'communication_attachment', 'stored_private', 'content_validated', 'wedding_record', false, 'private', 'private', '{}', 'vault-phase1-wedding-b', now(), now()),
  ('vault-phase1-object-retained', 'supabase', 'phase1/retained.pdf', 'retained.pdf', 'retained.pdf', 'application/pdf', 'pdf', 10, repeat('c',64), 'vault-phase1-user-a', 'communication_attachment', 'stored_private', 'content_validated', 'wedding_record', false, 'private', 'private', '{}', 'vault-phase1-wedding-a', now(), now());

INSERT INTO wewed_communications."CommunicationAttachment"
  ("id", "messageId", "conversationId", "vaultObjectId", "weddingId", "position", "createdByUserId")
VALUES
  ('vault-phase1-attachment-a', 'vault-phase1-message-a', 'vault-phase1-conversation-a', 'vault-phase1-object-a', 'vault-phase1-wedding-a', 0, 'vault-phase1-user-a');

DO $$
BEGIN
  BEGIN
    INSERT INTO wewed_communications."CommunicationAttachment"
      ("id", "messageId", "conversationId", "vaultObjectId", "weddingId", "position", "createdByUserId")
    VALUES
      ('vault-phase1-bad-conversation', 'vault-phase1-message-a', 'vault-phase1-conversation-a2', 'vault-phase1-object-a', 'vault-phase1-wedding-a', 0, 'vault-phase1-user-a');
    RAISE EXCEPTION 'message/conversation mismatch was accepted';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'message/conversation mismatch was accepted' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO wewed_communications."CommunicationAttachment"
      ("id", "messageId", "conversationId", "vaultObjectId", "weddingId", "position", "createdByUserId")
    VALUES
      ('vault-phase1-bad-wedding', 'vault-phase1-message-a', 'vault-phase1-conversation-a', 'vault-phase1-object-b', 'vault-phase1-wedding-b', 0, 'vault-phase1-user-a');
    RAISE EXCEPTION 'cross-wedding attachment was accepted';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'cross-wedding attachment was accepted' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO wewed_communications."CommunicationAttachment"
      ("id", "messageId", "conversationId", "vaultObjectId", "weddingId", "position", "createdByUserId")
    VALUES
      ('vault-phase1-no-wedding', 'vault-phase1-message-null', 'vault-phase1-conversation-null', 'vault-phase1-object-a', 'vault-phase1-wedding-a', 0, 'vault-phase1-user-a');
    RAISE EXCEPTION 'attachment on contextless conversation was accepted';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'attachment on contextless conversation was accepted' THEN RAISE; END IF;
  END;
END
$$;

-- Prove one binary can be linked to multiple governed contexts without duplication.
INSERT INTO public."VaultLink"
  ("id", "vaultObjectId", "weddingId", "entityType", "entityId", "linkRole", "createdById", "createdAt")
VALUES
  ('vault-phase1-link-message', 'vault-phase1-object-a', 'vault-phase1-wedding-a', 'communication_message', 'vault-phase1-message-a', 'attachment', 'vault-phase1-user-a', now()),
  ('vault-phase1-link-wedding', 'vault-phase1-object-a', 'vault-phase1-wedding-a', 'wedding', 'vault-phase1-wedding-a', 'wedding_document', 'vault-phase1-user-a', now());

DO $$
DECLARE
  object_count integer;
  link_count integer;
BEGIN
  SELECT count(*) INTO object_count FROM public."VaultObject" WHERE id='vault-phase1-object-a';
  SELECT count(*) INTO link_count FROM public."VaultLink" WHERE "vaultObjectId"='vault-phase1-object-a';
  IF object_count <> 1 OR link_count <> 2 THEN
    RAISE EXCEPTION 'Vault promotion duplicated a binary or failed to add governed links';
  END IF;
END
$$;

-- Deleting/hiding a chat message may remove its presentation attachment row but must not
-- destroy a separately promoted evidence object/link.
INSERT INTO wewed_communications."CommunicationAttachment"
  ("id", "messageId", "conversationId", "vaultObjectId", "weddingId", "position", "createdByUserId")
VALUES
  ('vault-phase1-attachment-retained', 'vault-phase1-message-retained', 'vault-phase1-conversation-a', 'vault-phase1-object-retained', 'vault-phase1-wedding-a', 0, 'vault-phase1-user-a');
INSERT INTO public."VaultLink"
  ("id", "vaultObjectId", "weddingId", "entityType", "entityId", "linkRole", "createdById", "createdAt")
VALUES
  ('vault-phase1-retained-evidence', 'vault-phase1-object-retained', 'vault-phase1-wedding-a', 'wedding', 'vault-phase1-wedding-a', 'evidence', 'vault-phase1-user-a', now());
DELETE FROM wewed_communications."CommunicationMessage" WHERE id='vault-phase1-message-retained';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM wewed_communications."CommunicationAttachment" WHERE id='vault-phase1-attachment-retained') THEN
    RAISE EXCEPTION 'chat presentation attachment did not cascade with deleted message';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."VaultObject" WHERE id='vault-phase1-object-retained') THEN
    RAISE EXCEPTION 'deleting chat presentation destroyed retained Vault object';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."VaultLink" WHERE id='vault-phase1-retained-evidence') THEN
    RAISE EXCEPTION 'deleting chat presentation destroyed promoted evidence link';
  END IF;
END
$$;

ROLLBACK;
