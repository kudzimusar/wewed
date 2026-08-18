import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync('prisma/migrations/20260819070000_phase5_wedding_media_archive/migration.sql', 'utf8')
const mediaService = readFileSync('src/lib/media/phase5.ts', 'utf8')
const mediaRoute = readFileSync('src/app/api/media/route.ts', 'utf8')
const mediaItemRoute = readFileSync('src/app/api/media/[id]/route.ts', 'utf8')
const contentRoute = readFileSync('src/app/api/media/[id]/content/route.ts', 'utf8')
const archiveRoute = readFileSync('src/app/api/media/archive/route.ts', 'utf8')
const exportRoute = readFileSync('src/app/api/media/archive/export/route.ts', 'utf8')
const archivePage = readFileSync('src/app/planner/media-archive/page.tsx', 'utf8')
const vaultCore = readFileSync('src/lib/vault/core.ts', 'utf8')
const vaultView = readFileSync('src/lib/vault/view.ts', 'utf8')

describe('Vault/Contracts Phase 5 wedding media governance', () => {
  test('routes all new wedding media originals through the existing private Vault', () => {
    expect(mediaRoute).toContain('ingestWeddingMedia')
    expect(mediaRoute).not.toContain("node:fs")
    expect(mediaRoute).not.toContain('public/uploads')
    expect(mediaRoute).not.toContain('writeFile')
    expect(mediaService).toContain('prepareVaultUpload')
    expect(mediaService).toContain('registerPreparedVaultObject')
    expect(mediaService).toContain("linkRole: 'media_original'")
    expect(mediaService).toContain("source: 'wedding_media_original'")
    expect(mediaService).toContain('controlledMediaUrl(mediaItemId)')
  })

  test('keeps publication separate from Vault privacy and serves managed media only through authorization', () => {
    expect(migration).toContain('"publicationState" text NOT NULL DEFAULT \'PRIVATE\'')
    expect(migration).toContain('"privacyState" text NOT NULL DEFAULT \'WEDDING_MEMBERS\'')
    expect(migration).toContain("'PRIVATE','PUBLISHED','UNPUBLISHED'")
    expect(migration).toContain("'PRIVATE','WEDDING_MEMBERS','INVITED_GUESTS','PUBLIC'")
    expect(contentRoute).toContain('resolveWeddingAccessForRequest')
    expect(contentRoute).toContain("content.publicationState === 'PUBLISHED'")
    expect(contentRoute).toContain("content.privacyState === 'PUBLIC'")
    expect(contentRoute).toContain('signedVaultView')
    expect(vaultView).toContain('.createSignedUrl(input.objectKey, WEWED_VAULT_SIGNED_URL_SECONDS)')
    expect(vaultCore).toContain("publicationState: 'private'")
  })

  test('creates governed image derivatives without replacing the original', () => {
    expect(migration).toContain('CREATE TABLE wewed_media."MediaDerivative"')
    expect(mediaService).toContain(".resize({ width: 640, withoutEnlargement: true })")
    expect(mediaService).toContain('.webp({ quality: 82 })')
    expect(mediaService).toContain("'THUMBNAIL'")
    expect(migration).toContain('A governed media original cannot be silently replaced')
  })

  test('records honest provenance and legacy backfill without fabricating ingestion', () => {
    expect(migration).toContain("'VAULT_MANAGED','LEGACY_EXTERNAL','BACKFILL_PENDING','BACKFILL_FAILED'")
    expect(migration).toContain("'COUPLE','GUEST','PLANNER','VENDOR','SYSTEM','LEGACY'")
    expect(migration).toContain('CREATE TABLE wewed_media."MediaBackfillRecord"')
    expect(migration).toContain("m.\"url\" NOT LIKE '/api/media/%'")
    expect(migration).toContain("'DISCOVERED'")
    expect(migration).not.toContain("SELECT 'INGESTED'")
    expect(mediaService).toContain("legacySourceUrl")
  })

  test('archives non-destructively and preserves Phase 4 evidence/legal holds', () => {
    expect(mediaItemRoute).toContain('archiveMediaItem')
    expect(mediaItemRoute).not.toContain('mediaItem.delete')
    expect(mediaItemRoute).not.toContain('unlink')
    expect(mediaService).toContain('destructiveDelete: false')
    expect(migration).toContain('Media under an evidence/legal hold cannot be archived')
    expect(migration).toContain('VaultObject_media_preservation_guard')
    expect(migration).toContain('Governed wedding media Vault objects cannot be hard-deleted')
  })

  test('implements forward-only wedding archive lifecycle and a couple export path', () => {
    expect(migration).toContain("'ACTIVE_PLANNING','LIVE_EVENT','POST_WEDDING','ARCHIVED'")
    expect(migration).toContain('WeddingArchive_transition_guard')
    expect(mediaService).toContain('buildCoupleExportManifest')
    expect(exportRoute).toContain("requireWeddingPermission(request, 'export.data')")
    expect(exportRoute).toContain('Content-Disposition')
    expect(archiveRoute).toContain("requireWeddingPermission(request, 'planner.view')")
    expect(archiveRoute).toContain("requireWeddingPermission(request, 'planner.edit')")
    expect(archivePage).toContain('Wedding Media Vault & Archive')
    expect(archivePage).toContain('Originals remain private.')
    expect(archivePage).toContain('Export manifest')
  })

  test('keeps the media governance schema private and server-authorized', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS wewed_media')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_media FROM PUBLIC')
    expect(migration).toContain("ARRAY['anon','authenticated']")
    expect(mediaItemRoute).toContain("resolved.access.accessKind !== 'couple_owner'")
    expect(contentRoute).toContain("return noStore(NextResponse.json({ success: false, error: 'Media is not available for this audience.' }")
  })

  test('supports website image/video types through content-signature validation rather than trusting extensions', () => {
    expect(vaultCore).toContain("'image/gif': 'gif'")
    expect(vaultCore).toContain("'video/mp4': 'mp4'")
    expect(vaultCore).toContain("'video/webm': 'webm'")
    expect(vaultCore).toContain("header !== 'GIF87a' && header !== 'GIF89a'")
    expect(vaultCore).toContain("box !== 'ftyp'")
    expect(vaultCore).toContain("[0x1a, 0x45, 0xdf, 0xa3]")
  })
})
