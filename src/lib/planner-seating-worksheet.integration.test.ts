import { randomUUID } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { db } from './db'
import { executeImport, rollbackImport, _clearRollbackStore } from './import-engine/executor'
import { exportModule } from './import-engine/exporter'
import { parseFile } from './import-engine/parser'
import { generatePreview } from './import-engine/preview'
import { getWorksheetSchema } from './import-engine/schema-resolver'
import type { ParsedFile } from './import-engine/types'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function worksheet(rows: Record<string, string>[]): ParsedFile {
  return {
    headers: ['Guest ID', 'Guest Name', 'Table ID', 'Table Name', 'Table Capacity'],
    rows,
    rowNumbers: rows.map((_row, index) => index + 2),
    formulaCells: [],
    rawRowCount: rows.length + 1,
    firstSheetName: 'Template',
  }
}

async function createWedding(nonce: string) {
  const couple = await db.couple.create({
    data: {
      slug: `seating-worksheet-couple-${nonce}`,
      partner1: 'Seating One',
      partner2: 'Seating Two',
    },
  })
  const wedding = await db.wedding.create({
    data: {
      slug: `seating-worksheet-wedding-${nonce}`,
      title: 'Seating Worksheet Contract',
      date: new Date('2027-05-01T12:00:00.000Z'),
      venue: 'Seating Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      coupleId: couple.id,
    },
  })
  return { couple, wedding }
}

describe('Seating worksheet relational contract', () => {
  test('exports every Guest and table, round-trips, unseats, manages empty tables and blocks over-capacity files', async () => {
    const nonce = randomUUID().replace(/-/g, '').slice(0, 12)
    const { couple, wedding } = await createWedding(nonce)
    const schema = getWorksheetSchema('seating')

    try {
      const occupiedTable = await db.seatingTable.create({
        data: { weddingId: wedding.id, name: 'Occupied Table', capacity: 2 },
      })
      const emptyTable = await db.seatingTable.create({
        data: { weddingId: wedding.id, name: 'Empty Table', capacity: 6 },
      })
      const assignedGuest = await db.guest.create({
        data: {
          weddingId: wedding.id,
          name: 'Assigned Seating Guest',
          role: 'guest',
          seatingTableId: occupiedTable.id,
        },
      })
      await db.rSVP.create({
        data: {
          token: `seating-assigned-${nonce}`,
          guestId: assignedGuest.id,
          plusOne: true,
        },
      })
      const unassignedGuest = await db.guest.create({
        data: {
          weddingId: wedding.id,
          name: 'Unassigned Seating Guest',
          role: 'guest',
        },
      })

      const exported = await exportModule(schema, wedding.id, 'xlsx')
      const parsed = await parseFile(exported, XLSX_MIME)
      expect(parsed.rows).toHaveLength(4)

      const unassignedRow = parsed.rows.find((row) => row['Guest ID'] === unassignedGuest.id)
      expect(unassignedRow).toBeDefined()
      expect(unassignedRow?.['Table ID']).toBe('')
      expect(unassignedRow?.['Table Name']).toBe('')

      const emptyTableRow = parsed.rows.find((row) => row['Table ID'] === emptyTable.id && !row['Guest ID'])
      expect(emptyTableRow).toBeDefined()
      expect(emptyTableRow?.['Table Name']).toBe('Empty Table')
      expect(emptyTableRow?.['Table Capacity']).toBe('6')

      const roundTrip = await generatePreview(parsed, schema, wedding.id, 'seating-export.xlsx')
      expect(roundTrip.invalidRows).toBe(0)
      expect(roundTrip.newRecords).toBe(0)
      expect(roundTrip.updateRecords).toBe(0)
      expect(roundTrip.skippedRecords).toBe(4)

      const assignedRow = parsed.rows.find((row) => row['Guest ID'] === assignedGuest.id)
      expect(assignedRow).toBeDefined()
      const unseatPreview = await generatePreview(worksheet([{
        ...assignedRow!,
        'Table ID': '',
        'Table Name': '',
        'Table Capacity': '',
      }]), schema, wedding.id, 'seating-unseat.xlsx')
      expect(unseatPreview.rows[0].action).toBe('update')
      const unseat = await executeImport(unseatPreview, schema, wedding.id)
      expect(unseat).toMatchObject({ created: 0, updated: 1, errors: 0 })
      expect(await db.guest.findUnique({ where: { id: assignedGuest.id } })).toMatchObject({ seatingTableId: null })
      expect(await rollbackImport(unseat.rollbackToken)).toMatchObject({ restored: 1, failed: 0 })
      expect(await db.guest.findUnique({ where: { id: assignedGuest.id } })).toMatchObject({ seatingTableId: occupiedTable.id })

      const tableCreatePreview = await generatePreview(worksheet([{
        'Guest ID': '',
        'Guest Name': '',
        'Table ID': '',
        'Table Name': 'New Empty Table',
        'Table Capacity': '4',
      }]), schema, wedding.id, 'seating-table-create.xlsx')
      expect(tableCreatePreview.rows[0].action).toBe('create')
      const tableCreate = await executeImport(tableCreatePreview, schema, wedding.id)
      expect(tableCreate).toMatchObject({ created: 1, updated: 0, errors: 0 })
      const createdTable = await db.seatingTable.findFirstOrThrow({
        where: { weddingId: wedding.id, name: 'New Empty Table' },
      })
      expect(createdTable.capacity).toBe(4)
      expect(await rollbackImport(tableCreate.rollbackToken)).toMatchObject({ deleted: 1, failed: 0 })
      expect(await db.seatingTable.findUnique({ where: { id: createdTable.id } })).toBeNull()

      const tableUpdatePreview = await generatePreview(worksheet([{
        'Guest ID': '',
        'Guest Name': '',
        'Table ID': emptyTable.id,
        'Table Name': emptyTable.name,
        'Table Capacity': '7',
      }]), schema, wedding.id, 'seating-table-update.xlsx')
      expect(tableUpdatePreview.rows[0].action).toBe('update')
      const tableUpdate = await executeImport(tableUpdatePreview, schema, wedding.id)
      expect(tableUpdate).toMatchObject({ created: 0, updated: 1, errors: 0 })
      expect(await db.seatingTable.findUnique({ where: { id: emptyTable.id } })).toMatchObject({ capacity: 7 })
      expect(await rollbackImport(tableUpdate.rollbackToken)).toMatchObject({ restored: 1, failed: 0 })
      expect(await db.seatingTable.findUnique({ where: { id: emptyTable.id } })).toMatchObject({ capacity: 6 })

      const overCapacity = await generatePreview(worksheet([{
        'Guest ID': unassignedGuest.id,
        'Guest Name': unassignedGuest.name,
        'Table ID': occupiedTable.id,
        'Table Name': occupiedTable.name,
        'Table Capacity': '2',
      }]), schema, wedding.id, 'seating-over-capacity.xlsx')
      expect(overCapacity.rows[0].action).toBe('invalid')
      expect(overCapacity.rows[0].errors.join(' ')).toContain('planned occupancy of 3')

      const newTableOverCapacity = await generatePreview(worksheet([
        {
          'Guest ID': assignedGuest.id,
          'Guest Name': assignedGuest.name,
          'Table ID': '',
          'Table Name': 'Too Small New Table',
          'Table Capacity': '2',
        },
        {
          'Guest ID': unassignedGuest.id,
          'Guest Name': unassignedGuest.name,
          'Table ID': '',
          'Table Name': 'Too Small New Table',
          'Table Capacity': '2',
        },
      ]), schema, wedding.id, 'seating-new-over-capacity.xlsx')
      expect(newTableOverCapacity.invalidRows).toBe(2)
      expect(newTableOverCapacity.rows.every((row) => row.errors.join(' ').includes('planned occupancy of 3'))).toBe(true)

      const mixedNewTable = await generatePreview(worksheet([
        {
          'Guest ID': '',
          'Guest Name': '',
          'Table ID': '',
          'Table Name': 'Mixed New Table',
          'Table Capacity': '4',
        },
        {
          'Guest ID': unassignedGuest.id,
          'Guest Name': unassignedGuest.name,
          'Table ID': '',
          'Table Name': 'Mixed New Table',
          'Table Capacity': '4',
        },
      ]), schema, wedding.id, 'seating-mixed-new-table.xlsx')
      expect(mixedNewTable.invalidRows).toBe(2)
      expect(mixedNewTable.rows.every((row) => row.errors.join(' ').includes('cannot be both a table-only row'))).toBe(true)
    } finally {
      _clearRollbackStore()
      await db.rSVP.deleteMany({ where: { guest: { weddingId: wedding.id } } }).catch(() => undefined)
      await db.guest.deleteMany({ where: { weddingId: wedding.id } }).catch(() => undefined)
      await db.seatingTable.deleteMany({ where: { weddingId: wedding.id } }).catch(() => undefined)
      await db.importJob.deleteMany({ where: { weddingId: wedding.id } }).catch(() => undefined)
      await db.wedding.delete({ where: { id: wedding.id } }).catch(() => undefined)
      await db.couple.delete({ where: { id: couple.id } }).catch(() => undefined)
    }
  }, 45_000)
})
