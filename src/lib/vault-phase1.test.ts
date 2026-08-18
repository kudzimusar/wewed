import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('Phase 1 Vault + communications architecture', () => {
  test('keeps communication attachments private and wedding-scoped', () => {
    const migration = source('prisma/migrations/20260818144500_phase1_vault_communications_attachments/migration.sql')
    expect(migration).toContain('wewed_communications."CommunicationAttachment"')
    expect(migration).toContain('FOREIGN KEY ("vaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId")')
    expect(migration).toContain('CommunicationAttachment_context_guard')
    expect(migration).toContain('Communication attachments require wedding context')
    expect(migration).toContain('SET search_path TO wewed_communications, public, pg_temp')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON FUNCTION')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON wewed_communications."CommunicationAttachment" FROM PUBLIC')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "vaultObjectId" text')
  })

  test('never moves the private attachment table into public Prisma', () => {
    const prisma = source('prisma/schema.prisma')
    expect(prisma).not.toMatch(/^model CommunicationAttachment\s*\{/m)
  })

  test('uses private storage, hashes content and fails closed for complex Office files', () => {
    const core = source('src/lib/vault/core.ts')
    expect(core).toContain("WEWED_VAULT_BUCKET = 'wewed-vault'")
    expect(core).toContain('public: false')
    expect(core).toContain("createHash('sha256')")
    expect(core).toContain("storageState: distributable ? 'stored_private' : 'quarantined'")
    expect(core).toContain("scanState: distributable ? 'content_validated' : 'external_scan_required'")
    expect(core).toContain('createSignedUrl')
    expect(core).not.toContain('getPublicUrl')
  })

  test('messages share one Vault object instead of creating a channel-specific binary store', () => {
    const service = source('src/lib/communications-attachments.ts')
    expect(service).toContain('prepareVaultUpload')
    expect(service).toContain('registerPreparedVaultObject')
    expect(service).toContain("entityType: 'communication_message'")
    expect(service).toContain("entityType: 'communication_conversation'")
    expect(service).not.toContain('createBucket')
    expect(service).not.toContain('getPublicUrl')
  })

  test('messages UI provides upload progress, cancellation, retry and secure attachment opening', () => {
    const composer = source('src/components/communications/communication-composer.tsx')
    const attachments = source('src/components/communications/communication-attachment-list.tsx')
    const workspace = source('src/components/communications/messages-workspace.tsx')
    expect(composer).toContain('xhr.upload.onprogress')
    expect(composer).toContain('Cancel attachment upload')
    expect(composer).toContain("failed ? 'Retry send' : 'Send message'")
    expect(composer).toContain('onDrop')
    expect(attachments).toContain('Open securely')
    expect(attachments).toContain('/promote')
    expect(workspace).toContain('data-communications-thread-scroll="true"')
    expect(workspace).toContain('CommunicationComposer')
    expect(workspace).toContain('CommunicationAttachmentList')
  })

  test('wedding-linked Notebook files are Vault-first while legacy contextless files remain compatible', () => {
    const notebook = source('src/lib/notebook/attachments.ts')
    expect(notebook).toContain('if (!note.weddingId)')
    expect(notebook).toContain('uploadLegacyAttachment')
    expect(notebook).toContain('prepareVaultUpload')
    expect(notebook).toContain("entityType: 'notebook_note'")
    expect(notebook).toContain("storageDomain: 'wewed_vault'")
    expect(notebook).toContain('binaryRetainedInVault')
  })

  test('legacy wedding Notebook backfill is scoped, idempotent and never deletes source before commit', () => {
    const backfill = source('src/lib/notebook/vault-backfill.ts')
    const route = source('src/app/api/admin/vault/notebook-backfill/route.ts')
    expect(backfill).toContain('a."vaultObjectId" IS NULL')
    expect(backfill).toContain('FOR UPDATE OF a')
    expect(backfill).toContain('prepareVaultUpload')
    expect(backfill).toContain('registerPreparedVaultObject')
    expect(backfill).toContain('legacyStorageKey')
    expect(backfill.indexOf('await db.$transaction')).toBeLessThan(backfill.indexOf('.remove([attachment.storageKey])'))
    expect(route).toContain("requireWewedAdmin(request, 'admin.support.manage')")
    expect(route).toContain('assertAdminHistoricalWeddingScope')
  })

  test('generic Vault has no destructive endpoint or permanent public URL and records governed access', () => {
    const api = source('src/app/api/vault/route.ts')
    const download = source('src/app/api/vault/[id]/route.ts')
    const catalog = source('src/lib/vault/catalog.ts')
    expect(api).toContain('requireVaultWeddingAccess')
    expect(download).toContain('authorizeVaultObjectDownload')
    expect(download).toContain("action: 'vault.object.access_authorized'")
    expect(catalog).toContain("action: 'vault.object.uploaded'")
    expect(catalog).not.toContain('getPublicUrl')
    expect(api).not.toContain('export async function DELETE')
    expect(download).not.toContain('export async function DELETE')
  })

  test('Admin observability is wedding-scoped and privacy-safe', () => {
    const status = source('src/lib/vault/status.ts')
    const route = source('src/app/api/admin/vault/status/route.ts')
    const promotion = source('src/app/api/communications/attachments/[id]/promote/route.ts')
    expect(status).toContain('legacyEligibleForBackfill')
    expect(status).toContain('external_scan_required')
    expect(route).toContain("requireWewedAdmin(request, 'admin.support.read')")
    expect(route).toContain('assertAdminHistoricalWeddingScope')
    expect(promotion).toContain("action: 'vault.attachment.promoted'")
    expect(status).not.toContain('signedUrl')
    expect(status).not.toContain('originalFilename')
  })
})
