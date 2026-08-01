import { describe, expect, test } from 'bun:test'
import { generatePreview } from './import-engine/preview'
import { guestWorksheetSchema } from './import-engine/guest-worksheet-schema'
import type { ParsedFile } from './import-engine/types'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

function guestRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guest-1',
    name: 'Tariro Test',
    email: 'tariro@example.com',
    phone: '+263700000001',
    role: 'family',
    roleDetail: null,
    side: 'bride',
    tableNumber: null,
    seatingTableId: null,
    weddingId: 'wedding-1',
    rsvp: null,
    seatingTable: null,
    worksheet: null,
    ...overrides,
  }
}

describe('Planner production blocker repair', () => {
  test('migration is additive and repairs Vendor and Timeline drift', async () => {
    const migration = await source(
      'prisma/migrations/20260731173000_repair_planner_blockers/migration.sql',
    )

    for (const marker of [
      'ALTER TABLE public."Vendor"',
      '"contact" TEXT',
      '"contractStatus" TEXT NOT NULL DEFAULT \'pending\'',
      '"paymentStatus" TEXT NOT NULL DEFAULT \'unpaid\'',
      '"planningRating" DOUBLE PRECISION',
      '"notes" TEXT',
      'ALTER TABLE public."ProgrammeItem"',
      '"duration" TEXT',
      '"location" TEXT',
      '"displayIcon" TEXT',
      'CREATE SCHEMA IF NOT EXISTS wewed_planner',
      'CREATE TABLE IF NOT EXISTS wewed_planner."GuestWorksheetData"',
      'FOREIGN KEY ("guestId") REFERENCES public."Guest"("id") ON DELETE CASCADE',
      'FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE CASCADE',
      'REVOKE ALL ON SCHEMA wewed_planner FROM PUBLIC',
    ]) {
      expect(migration).toContain(marker)
    }

    expect(migration).not.toContain('DROP TABLE')
    expect(migration).not.toContain('DROP COLUMN')
    expect(migration).not.toContain('TRUNCATE')
  })

  test('Vendor and Timeline APIs remain wedding scoped and use normalized fields', async () => {
    const [vendors, vendorItem, timeline, timelineItem] = await Promise.all([
      source('src/app/api/planner/vendors/route.ts'),
      source('src/app/api/planner/vendors/[id]/route.ts'),
      source('src/app/api/planner/timeline/route.ts'),
      source('src/app/api/planner/timeline/[id]/route.ts'),
    ])

    for (const marker of ['contact', 'contractStatus', 'paymentStatus', 'planningRating', 'notes']) {
      expect(vendors).toContain(marker)
      expect(vendorItem).toContain(marker)
    }
    expect(vendors).toContain('weddingId: access.context.weddingId')
    expect(vendorItem).toContain('where: { id, weddingId: access.context.weddingId }')

    for (const marker of ['duration', 'location', 'displayIcon']) {
      expect(timeline).toContain(marker)
      expect(timelineItem).toContain(marker)
    }
    expect(timeline).toContain('weddingId: access.context.weddingId')
    expect(timelineItem).toContain('where: { id, weddingId: access.context.weddingId }')
  })

  test('Guests worksheet exposes the complete twenty-field lossless contract', () => {
    expect(guestWorksheetSchema.key).toBe('guests')
    expect(guestWorksheetSchema.version).toBe('1.1.0')
    expect(guestWorksheetSchema.fields.map((field) => field.label)).toEqual([
      'Guest ID',
      'First Name',
      'Last Name',
      'Display Name',
      'Email',
      'Phone',
      'Family/Group',
      'Invitation Status',
      'RSVP Status',
      'Number Attending',
      'Plus-One Name',
      'Number of Children',
      'Dietary',
      'Accessibility',
      'Transport',
      'Accommodation',
      'Table Assignment',
      'Seat Assignment',
      'Public Notes',
      'Private Notes',
    ])
  })

  test('Guest matching prioritizes wedding-scoped ID, then email, then unique name', () => {
    const records = [
      guestRecord(),
      guestRecord({ id: 'guest-2', name: 'Same Name', email: null, phone: '111' }),
      guestRecord({ id: 'guest-3', name: 'Same Name', email: null, phone: '222' }),
    ]
    const match = guestWorksheetSchema.matchExisting!

    expect(match({ guestId: 'guest-1' }, records).record?.id).toBe('guest-1')
    expect(match({ guestId: 'other-wedding-id' }, records).error).toContain('selected wedding')
    expect(match({ email: ' TARIRO@example.com ' }, records).record?.id).toBe('guest-1')
    expect(match({ displayName: 'Tariro Test' }, records).record?.id).toBe('guest-1')
    expect(match({ displayName: 'Same Name' }, records).error).toContain('ambiguous')
    expect(match({ displayName: 'Same Name', phone: '222' }, records).record?.id).toBe('guest-3')
  })

  test('lookup-only updates are valid but unresolved email-only creates are blocked', () => {
    expect(guestWorksheetSchema.validateRow({ guestId: 'guest-1', dietary: 'Vegetarian' })).toEqual([])
    expect(guestWorksheetSchema.validateRow({ email: 'tariro@example.com', dietary: 'Vegetarian' })).toEqual([])
    expect(guestWorksheetSchema.validateRow({ dietary: 'Vegetarian' })).toContain(
      'Either "First Name" or "Display Name" is required',
    )

    const unresolved = guestWorksheetSchema.matchExisting!({ email: 'new@example.com' }, [])
    expect(unresolved.error).toContain('name is required')
  })

  test('preview is idempotent, detects cross-wedding IDs and preserves blank updates', async () => {
    const record = guestRecord()
    const schema = {
      ...guestWorksheetSchema,
      fetchExisting: async () => [record],
    }

    const unchanged: ParsedFile = {
      headers: ['Guest ID'],
      rows: [{ 'Guest ID': 'guest-1' }],
      rawRowCount: 2,
    }
    const unchangedPreview = await generatePreview(
      unchanged,
      schema,
      'wedding-1',
      'unchanged.xlsx',
    )
    expect(unchangedPreview.rows[0].action).toBe('skip')
    expect(unchangedPreview.newRecords).toBe(0)
    expect(unchangedPreview.updateRecords).toBe(0)

    const changed: ParsedFile = {
      headers: ['Guest ID', 'Dietary'],
      rows: [{ 'Guest ID': 'guest-1', Dietary: 'Vegetarian' }],
      rawRowCount: 2,
    }
    const changedPreview = await generatePreview(changed, schema, 'wedding-1', 'changed.xlsx')
    expect(changedPreview.rows[0].action).toBe('update')
    expect(changedPreview.rows[0].existingId).toBe('guest-1')

    const foreign: ParsedFile = {
      headers: ['Guest ID', 'Display Name'],
      rows: [{ 'Guest ID': 'foreign-id', 'Display Name': 'Foreign Guest' }],
      rawRowCount: 2,
    }
    const foreignPreview = await generatePreview(foreign, schema, 'wedding-1', 'foreign.xlsx')
    expect(foreignPreview.rows[0].action).toBe('invalid')
    expect(foreignPreview.rows[0].errors.join(' ')).toContain('selected wedding')
  })

  test('Guests export includes every role and transactional execution covers RSVP and Seating', async () => {
    const [read, apply, execute, rollback] = await Promise.all([
      source('src/lib/import-engine/guest-worksheet-read.ts'),
      source('src/lib/import-engine/guest-worksheet-apply.ts'),
      source('src/lib/import-engine/guest-worksheet-executor.ts'),
      source('src/lib/import-engine/guest-worksheet-rollback.ts'),
    ])

    expect(read).toContain('where: { weddingId }')
    expect(read).not.toContain("role: 'guest'")
    expect(apply).toContain('return db.$transaction')
    expect(apply).toContain('where: { id: existingId, weddingId }')
    expect(apply).toContain('occupied >= table.capacity')
    expect(apply).toContain('tx.rSVP.update')
    expect(apply).toContain('tx.rSVP.create')
    expect(apply).toContain('saveGuestWorksheetData')
    expect(apply).toContain('...(input.email ? { email: input.email } : {})')
    expect(apply).toContain('requestedUpdateName')
    expect(execute).toContain('snapshotGuestWorksheetState')
    expect(execute).toContain("kind: 'guest-worksheet-v2'")
    expect(rollback).toContain('state.guest')
    expect(rollback).toContain('state.rsvp')
    expect(rollback).toContain('state.worksheet')
    expect(rollback).toContain('removeGuestWorksheetData')
  })

  test('worksheet endpoints isolate the Guest override and preserve all other modules', async () => {
    const [resolver, previewRoute, templateRoute, exportRoute, executeRoute, post, rollback] = await Promise.all([
      source('src/lib/import-engine/schema-resolver.ts'),
      source('src/app/api/imports/route.ts'),
      source('src/app/api/templates/route.ts'),
      source('src/app/api/exports/route.ts'),
      source('src/app/api/imports/[jobId]/route.ts'),
      source('src/lib/import-engine/import-job-post.ts'),
      source('src/lib/import-engine/import-job-rollback.ts'),
    ])

    expect(resolver).toContain("moduleKey === 'guests' ? guestWorksheetSchema : getModuleSchema(moduleKey)")
    expect(previewRoute).toContain('getWorksheetSchema(moduleKey)')
    expect(templateRoute).toContain('getWorksheetSchema(moduleKey)')
    expect(exportRoute).toContain('getWorksheetSchema(moduleKey)')
    expect(executeRoute).toContain('export async function POST')
    expect(executeRoute).toContain('handleImportJobPost(request, context)')
    expect(executeRoute).toContain('export async function DELETE')
    expect(executeRoute).toContain('handleImportJobDelete(request, context)')
    expect(post).toContain("preview.moduleKey === 'guests'")
    expect(post).toContain('executeGuestWorksheetImport')
    expect(post).toContain('executeImport(preview, schema')
    expect(rollback).toContain("job.moduleKey === 'guests'")
    expect(rollback).toContain('rollbackGuestWorksheetImport')
    expect(rollback).toContain('rollbackImport(job.rollbackToken)')
  })
})
