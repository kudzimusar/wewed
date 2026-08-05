import { randomUUID } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { db } from './db'
import { executeImport, rollbackImport, _clearRollbackStore } from './import-engine/executor'
import { exportModule } from './import-engine/exporter'
import { parseFile } from './import-engine/parser'
import { generatePreview } from './import-engine/preview'
import { getWorksheetSchema } from './import-engine/schema-resolver'
import type { ModuleKey, ParsedFile } from './import-engine/types'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function worksheet(rows: Record<string, string>[]): ParsedFile {
  return {
    headers: Object.keys(rows[0] ?? {}),
    rows,
    rowNumbers: rows.map((_row, index) => index + 2),
    formulaCells: [],
    rawRowCount: rows.length + 1,
    firstSheetName: 'Template',
  }
}

async function previewRow(
  moduleKey: ModuleKey,
  weddingId: string,
  row: Record<string, string>,
  fileName: string,
) {
  return generatePreview(worksheet([row]), getWorksheetSchema(moduleKey), weddingId, fileName)
}

async function exportedFile(moduleKey: ModuleKey, weddingId: string): Promise<ParsedFile> {
  const schema = getWorksheetSchema(moduleKey)
  const buffer = await exportModule(schema, weddingId, 'xlsx')
  return parseFile(buffer, XLSX_MIME)
}

async function createWedding(nonce: string, suffix: string) {
  const couple = await db.couple.create({
    data: {
      slug: `worksheet-contract-couple-${suffix}-${nonce}`,
      partner1: 'Worksheet One',
      partner2: 'Worksheet Two',
    },
  })
  const wedding = await db.wedding.create({
    data: {
      slug: `worksheet-contract-wedding-${suffix}-${nonce}`,
      title: `Worksheet Contract ${suffix}`,
      date: new Date('2027-04-10T12:00:00.000Z'),
      venue: 'Contract Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      coupleId: couple.id,
    },
  })
  return { couple, wedding }
}

describe('Planner worksheet recovery PostgreSQL contract', () => {
  test('Tasks, Vendors, Budget, Timeline and Seating create/update/export/rollback without loss or cross-wedding access', async () => {
    const nonce = randomUUID().replace(/-/g, '').slice(0, 12)
    const weddingIds: string[] = []
    const coupleIds: string[] = []
    let actorId: string | undefined

    try {
      const primary = await createWedding(nonce, 'primary')
      const foreign = await createWedding(nonce, 'foreign')
      weddingIds.push(primary.wedding.id, foreign.wedding.id)
      coupleIds.push(primary.couple.id, foreign.couple.id)

      const actor = await db.user.create({
        data: {
          email: `worksheet-contract-${nonce}@example.com`,
          name: 'Worksheet Contract Actor',
          role: 'planner',
          isActive: true,
          currentWeddingId: primary.wedding.id,
        },
      })
      actorId = actor.id
      const executionContext = { actorId: actor.id }

      // -------------------------------------------------------------------
      // Tasks
      // -------------------------------------------------------------------
      const taskSchema = getWorksheetSchema('checklist')
      const taskCreatePreview = await previewRow('checklist', primary.wedding.id, {
        Task: 'Worksheet contract task',
        Category: 'venue',
        Description: 'Description must survive blank updates',
        'Assigned Person': 'Charity',
        'Due Date': '2027-01-15',
        Priority: 'high',
        Status: 'todo',
        Order: '7',
      }, 'task-create.xlsx')
      expect(taskCreatePreview.rows[0].action).toBe('create')
      const taskCreate = await executeImport(taskCreatePreview, taskSchema, primary.wedding.id, executionContext)
      expect(taskCreate).toMatchObject({ created: 1, updated: 0, skipped: 0, errors: 0 })
      const task = await db.plannerTask.findFirstOrThrow({
        where: { weddingId: primary.wedding.id, title: 'Worksheet contract task' },
      })
      expect(task).toMatchObject({
        description: 'Description must survive blank updates',
        assignee: 'Charity',
        priority: 'high',
        status: 'todo',
        order: 7,
      })
      const taskExport = await exportedFile('checklist', primary.wedding.id)
      const taskRepeat = await generatePreview(taskExport, taskSchema, primary.wedding.id, 'task-export.xlsx')
      expect(taskRepeat.rows[0].action).toBe('skip')
      const taskUpdateRow = { ...taskExport.rows[0], Description: '', Status: 'in_progress' }
      const taskUpdatePreview = await generatePreview(worksheet([taskUpdateRow]), taskSchema, primary.wedding.id, 'task-update.xlsx')
      expect(taskUpdatePreview.rows[0].action).toBe('update')
      const taskUpdate = await executeImport(taskUpdatePreview, taskSchema, primary.wedding.id, executionContext)
      expect(taskUpdate).toMatchObject({ created: 0, updated: 1, errors: 0 })
      expect(await db.plannerTask.findUnique({ where: { id: task.id } })).toMatchObject({
        description: 'Description must survive blank updates', status: 'in_progress',
      })
      expect(await rollbackImport(taskUpdate.rollbackToken, executionContext)).toMatchObject({ restored: 1, failed: 0 })
      expect(await db.plannerTask.findUnique({ where: { id: task.id } })).toMatchObject({ status: 'todo' })
      expect(await rollbackImport(taskCreate.rollbackToken, executionContext)).toMatchObject({ deleted: 1, failed: 0 })
      expect(await db.plannerTask.findUnique({ where: { id: task.id } })).toBeNull()

      // -------------------------------------------------------------------
      // Vendors + planner pipeline
      // -------------------------------------------------------------------
      const vendorSchema = getWorksheetSchema('vendors')
      const vendorCreatePreview = await previewRow('vendors', primary.wedding.id, {
        'Vendor Name': 'Worksheet Golden Lens',
        Category: 'photographer',
        Description: 'Description must survive blank updates',
        Contact: 'Tariro Vendor',
        Phone: '+263770001234',
        Website: 'https://example.com/vendor',
        'Contract Status': 'pending',
        'Payment Status': 'unpaid',
        Rating: '4.5',
        Notes: 'Pipeline notes',
        Featured: 'No',
      }, 'vendor-create.xlsx')
      expect(vendorCreatePreview.rows[0].action).toBe('create')
      const vendorCreate = await executeImport(vendorCreatePreview, vendorSchema, primary.wedding.id, executionContext)
      expect(vendorCreate).toMatchObject({ created: 1, updated: 0, errors: 0 })
      const vendor = await db.vendor.findFirstOrThrow({
        where: { weddingId: primary.wedding.id, name: 'Worksheet Golden Lens' },
      })
      expect(vendor).toMatchObject({
        contact: 'Tariro Vendor',
        phone: '+263770001234',
        contractStatus: 'pending',
        paymentStatus: 'unpaid',
        planningRating: 4.5,
        notes: 'Pipeline notes',
      })
      const pipelineBefore = await db.contentRevision.findFirstOrThrow({
        where: { weddingId: primary.wedding.id, section: 'planner_vendor_pipeline', fieldKey: vendor.id },
      })
      const vendorExport = await exportedFile('vendors', primary.wedding.id)
      const vendorRepeat = await generatePreview(vendorExport, vendorSchema, primary.wedding.id, 'vendor-export.xlsx')
      expect(vendorRepeat.rows[0].action).toBe('skip')
      const vendorUpdateRow = {
        ...vendorExport.rows[0],
        Description: '',
        'Contract Status': 'signed',
        'Payment Status': 'deposit',
        Featured: 'Yes',
      }
      const vendorUpdatePreview = await generatePreview(worksheet([vendorUpdateRow]), vendorSchema, primary.wedding.id, 'vendor-update.xlsx')
      expect(vendorUpdatePreview.rows[0].action).toBe('update')
      const vendorUpdate = await executeImport(vendorUpdatePreview, vendorSchema, primary.wedding.id, executionContext)
      expect(vendorUpdate).toMatchObject({ updated: 1, errors: 0 })
      expect(await db.vendor.findUnique({ where: { id: vendor.id } })).toMatchObject({
        description: 'Description must survive blank updates',
        contractStatus: 'signed',
        paymentStatus: 'deposit',
        featured: true,
      })
      const pipelineUpdated = await db.contentRevision.findFirstOrThrow({
        where: { weddingId: primary.wedding.id, section: 'planner_vendor_pipeline', fieldKey: vendor.id },
      })
      expect(pipelineUpdated.value).not.toBe(pipelineBefore.value)
      expect(await rollbackImport(vendorUpdate.rollbackToken, executionContext)).toMatchObject({ restored: 1, failed: 0 })
      expect(await db.vendor.findUnique({ where: { id: vendor.id } })).toMatchObject({
        contractStatus: 'pending', paymentStatus: 'unpaid', featured: false,
      })
      const pipelineRestored = await db.contentRevision.findFirstOrThrow({
        where: { weddingId: primary.wedding.id, section: 'planner_vendor_pipeline', fieldKey: vendor.id },
      })
      expect(pipelineRestored.value).toBe(pipelineBefore.value)
      expect(await rollbackImport(vendorCreate.rollbackToken, executionContext)).toMatchObject({ deleted: 1, failed: 0 })
      expect(await db.vendor.findUnique({ where: { id: vendor.id } })).toBeNull()
      expect(await db.contentRevision.findFirst({
        where: { weddingId: primary.wedding.id, section: 'planner_vendor_pipeline', fieldKey: vendor.id },
      })).toBeNull()

      // -------------------------------------------------------------------
      // Budget with active-wedding Vendor reference
      // -------------------------------------------------------------------
      const budgetVendor = await db.vendor.create({
        data: {
          weddingId: primary.wedding.id,
          name: 'Worksheet Budget Vendor',
          category: 'venue',
          contractStatus: 'signed',
          paymentStatus: 'deposit',
        },
      })
      const budgetSchema = getWorksheetSchema('budget')
      const budgetCreatePreview = await previewRow('budget', primary.wedding.id, {
        Category: 'venue',
        Description: 'Worksheet venue hire',
        'Estimated Cost': '5000',
        'Actual Cost': '4800',
        'Paid Amount': '1500',
        Currency: 'USD',
        'Vendor ID': budgetVendor.id,
        Vendor: budgetVendor.name,
        Notes: 'Budget notes must survive blank updates',
        'Due Date': '2027-02-01',
      }, 'budget-create.xlsx')
      expect(budgetCreatePreview.rows[0].action).toBe('create')
      const budgetCreate = await executeImport(budgetCreatePreview, budgetSchema, primary.wedding.id, executionContext)
      expect(budgetCreate).toMatchObject({ created: 1, updated: 0, errors: 0 })
      const budget = await db.budgetItem.findFirstOrThrow({
        where: { weddingId: primary.wedding.id, description: 'Worksheet venue hire' },
      })
      expect(budget).toMatchObject({
        estimatedCost: 5000,
        actualCost: 4800,
        paidAmount: 1500,
        currency: 'USD',
        vendorId: budgetVendor.id,
        vendorName: budgetVendor.name,
      })
      const budgetExport = await exportedFile('budget', primary.wedding.id)
      const budgetRepeat = await generatePreview(budgetExport, budgetSchema, primary.wedding.id, 'budget-export.xlsx')
      expect(budgetRepeat.rows[0].action).toBe('skip')
      const budgetUpdateRow = { ...budgetExport.rows[0], 'Actual Cost': '4700', Notes: '' }
      const budgetUpdatePreview = await generatePreview(worksheet([budgetUpdateRow]), budgetSchema, primary.wedding.id, 'budget-update.xlsx')
      expect(budgetUpdatePreview.rows[0].action).toBe('update')
      const budgetUpdate = await executeImport(budgetUpdatePreview, budgetSchema, primary.wedding.id, executionContext)
      expect(budgetUpdate).toMatchObject({ updated: 1, errors: 0 })
      expect(await db.budgetItem.findUnique({ where: { id: budget.id } })).toMatchObject({
        actualCost: 4700,
        notes: 'Budget notes must survive blank updates',
      })
      expect(await rollbackImport(budgetUpdate.rollbackToken, executionContext)).toMatchObject({ restored: 1, failed: 0 })
      expect(await db.budgetItem.findUnique({ where: { id: budget.id } })).toMatchObject({ actualCost: 4800 })
      expect(await rollbackImport(budgetCreate.rollbackToken, executionContext)).toMatchObject({ deleted: 1, failed: 0 })
      expect(await db.budgetItem.findUnique({ where: { id: budget.id } })).toBeNull()

      // -------------------------------------------------------------------
      // Timeline
      // -------------------------------------------------------------------
      const timelineSchema = getWorksheetSchema('timeline')
      const timelineCreatePreview = await previewRow('timeline', primary.wedding.id, {
        Time: '14:00',
        Activity: 'Worksheet guest arrival',
        Description: 'Description must survive blank updates',
        Duration: '30 minutes',
        Location: 'Main Lawn',
        Icon: 'arrival',
        Order: '3',
      }, 'timeline-create.xlsx')
      expect(timelineCreatePreview.rows[0].action).toBe('create')
      const timelineCreate = await executeImport(timelineCreatePreview, timelineSchema, primary.wedding.id, executionContext)
      expect(timelineCreate).toMatchObject({ created: 1, errors: 0 })
      const timeline = await db.programmeItem.findFirstOrThrow({
        where: { weddingId: primary.wedding.id, title: 'Worksheet guest arrival' },
      })
      expect(timeline).toMatchObject({
        time: '14:00', duration: '30 minutes', location: 'Main Lawn', displayIcon: 'arrival', order: 3,
      })
      const timelineExport = await exportedFile('timeline', primary.wedding.id)
      const timelineRepeat = await generatePreview(timelineExport, timelineSchema, primary.wedding.id, 'timeline-export.xlsx')
      expect(timelineRepeat.rows[0].action).toBe('skip')
      const timelineUpdateRow = { ...timelineExport.rows[0], Description: '', Location: 'Ceremony Lawn' }
      const timelineUpdatePreview = await generatePreview(worksheet([timelineUpdateRow]), timelineSchema, primary.wedding.id, 'timeline-update.xlsx')
      expect(timelineUpdatePreview.rows[0].action).toBe('update')
      const timelineUpdate = await executeImport(timelineUpdatePreview, timelineSchema, primary.wedding.id, executionContext)
      expect(timelineUpdate).toMatchObject({ updated: 1, errors: 0 })
      expect(await db.programmeItem.findUnique({ where: { id: timeline.id } })).toMatchObject({
        description: 'Description must survive blank updates', location: 'Ceremony Lawn',
      })
      expect(await rollbackImport(timelineUpdate.rollbackToken, executionContext)).toMatchObject({ restored: 1, failed: 0 })
      expect(await db.programmeItem.findUnique({ where: { id: timeline.id } })).toMatchObject({ location: 'Main Lawn' })
      expect(await rollbackImport(timelineCreate.rollbackToken, executionContext)).toMatchObject({ deleted: 1, failed: 0 })
      expect(await db.programmeItem.findUnique({ where: { id: timeline.id } })).toBeNull()

      // -------------------------------------------------------------------
      // Seating: existing Guest only, capacity enforced, relational rollback
      // -------------------------------------------------------------------
      const seatingGuest = await db.guest.create({
        data: { weddingId: primary.wedding.id, name: 'Worksheet Seating Guest', role: 'guest', side: 'neutral' },
      })
      await db.rSVP.create({
        data: {
          token: `worksheet-rsvp-${nonce}`,
          guestId: seatingGuest.id,
          plusOne: true,
        },
      })
      const seatingSchema = getWorksheetSchema('seating')
      const seatingCreatePreview = await previewRow('seating', primary.wedding.id, {
        'Guest ID': seatingGuest.id,
        'Guest Name': seatingGuest.name,
        'Table Name': 'Worksheet Family Table',
        'Table Capacity': '2',
      }, 'seating-assign.xlsx')
      expect(seatingCreatePreview.rows[0].action).toBe('update')
      const seatingAssign = await executeImport(seatingCreatePreview, seatingSchema, primary.wedding.id, executionContext)
      expect(seatingAssign).toMatchObject({ created: 0, updated: 1, errors: 0 })
      const seatingTable = await db.seatingTable.findFirstOrThrow({
        where: { weddingId: primary.wedding.id, name: 'Worksheet Family Table' },
      })
      expect(await db.guest.findUnique({ where: { id: seatingGuest.id } })).toMatchObject({ seatingTableId: seatingTable.id })
      const seatingExport = await exportedFile('seating', primary.wedding.id)
      const seatingRepeat = await generatePreview(seatingExport, seatingSchema, primary.wedding.id, 'seating-export.xlsx')
      expect(seatingRepeat.rows[0].action).toBe('skip')
      const seatingUpdateRow = { ...seatingExport.rows[0], 'Table Capacity': '3' }
      const seatingUpdatePreview = await generatePreview(worksheet([seatingUpdateRow]), seatingSchema, primary.wedding.id, 'seating-update.xlsx')
      expect(seatingUpdatePreview.rows[0].action).toBe('update')
      const seatingUpdate = await executeImport(seatingUpdatePreview, seatingSchema, primary.wedding.id, executionContext)
      expect(seatingUpdate).toMatchObject({ updated: 1, errors: 0 })
      expect(await db.seatingTable.findUnique({ where: { id: seatingTable.id } })).toMatchObject({ capacity: 3 })
      expect(await rollbackImport(seatingUpdate.rollbackToken, executionContext)).toMatchObject({ restored: 1, failed: 0 })
      expect(await db.seatingTable.findUnique({ where: { id: seatingTable.id } })).toMatchObject({ capacity: 2 })
      expect(await rollbackImport(seatingAssign.rollbackToken, executionContext)).toMatchObject({ restored: 1, failed: 0 })
      expect(await db.guest.findUnique({ where: { id: seatingGuest.id } })).toMatchObject({ seatingTableId: null })
      expect(await db.seatingTable.findUnique({ where: { id: seatingTable.id } })).toBeNull()

      // -------------------------------------------------------------------
      // Cross-wedding IDs fail in preview for every worksheet module.
      // -------------------------------------------------------------------
      const foreignTask = await db.plannerTask.create({
        data: { weddingId: foreign.wedding.id, title: 'Foreign task', category: 'venue' },
      })
      const foreignVendor = await db.vendor.create({
        data: { weddingId: foreign.wedding.id, name: 'Foreign vendor', category: 'venue' },
      })
      const foreignBudget = await db.budgetItem.create({
        data: { weddingId: foreign.wedding.id, category: 'venue', description: 'Foreign budget', estimatedCost: 1 },
      })
      const foreignTimeline = await db.programmeItem.create({
        data: { weddingId: foreign.wedding.id, time: '10:00', title: 'Foreign timeline' },
      })
      const foreignGuest = await db.guest.create({
        data: { weddingId: foreign.wedding.id, name: 'Foreign seating guest', role: 'guest' },
      })
      const foreignTable = await db.seatingTable.create({
        data: { weddingId: foreign.wedding.id, name: 'Foreign table', capacity: 8 },
      })

      const foreignCases: Array<[ModuleKey, Record<string, string>]> = [
        ['checklist', { 'Task ID': foreignTask.id, Task: foreignTask.title, Category: 'venue' }],
        ['vendors', { 'Vendor ID': foreignVendor.id, 'Vendor Name': foreignVendor.name, Category: 'venue' }],
        ['budget', { 'Budget Item ID': foreignBudget.id, Category: 'venue', Description: foreignBudget.description, 'Estimated Cost': '1', 'Vendor ID': foreignVendor.id, Vendor: foreignVendor.name }],
        ['timeline', { 'Timeline Item ID': foreignTimeline.id, Time: foreignTimeline.time, Activity: foreignTimeline.title }],
        ['seating', { 'Guest ID': foreignGuest.id, 'Guest Name': foreignGuest.name, 'Table ID': foreignTable.id, 'Table Name': foreignTable.name }],
      ]
      for (const [moduleKey, row] of foreignCases) {
        const preview = await previewRow(moduleKey, primary.wedding.id, row, `${moduleKey}-foreign.xlsx`)
        expect(preview.rows[0].action).toBe('invalid')
        expect(preview.rows[0].errors.join(' ').toLowerCase()).toContain('active wedding')
      }
    } finally {
      _clearRollbackStore()
      if (weddingIds.length) {
        await db.contentRevision.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.auditEvent.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.rSVP.deleteMany({ where: { guest: { weddingId: { in: weddingIds } } } }).catch(() => undefined)
        await db.budgetItem.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.plannerTask.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.programmeItem.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.guest.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.seatingTable.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.vendor.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
        await db.importJob.deleteMany({ where: { weddingId: { in: weddingIds } } }).catch(() => undefined)
      }
      if (actorId) await db.user.delete({ where: { id: actorId } }).catch(() => undefined)
      if (weddingIds.length) await db.wedding.deleteMany({ where: { id: { in: weddingIds } } }).catch(() => undefined)
      if (coupleIds.length) await db.couple.deleteMany({ where: { id: { in: coupleIds } } }).catch(() => undefined)
    }
  }, 45_000)
})
