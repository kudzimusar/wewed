import { db } from '@/lib/db'
import type {
  ExistingRecordMatch,
  FieldDefinition,
  ImportExecutionContext,
  ModuleSchema,
  PreviewBatchRow,
} from './types'

const DEFAULT_CAPACITY = 8
const MAX_CAPACITY = 50

type SeatingKind = 'guest' | 'table'

type GuestRecord = {
  id: string
  name: string
  weddingId: string
  seatingTableId: string | null
  tableNumber: number | null
  rsvp?: {
    plusOne: boolean
    kidsAttending: boolean
    kidsCount: number
  } | null
  seatingTable?: TableRecord | null
}

type TableRecord = {
  id: string
  name: string
  capacity: number
  position: string | null
  weddingId: string
}

type SeatingExisting =
  | { id: string; kind: 'guest'; guest: GuestRecord }
  | { id: string; kind: 'table'; table: TableRecord }

interface SeatingRecord {
  kind: SeatingKind
  guestId?: string
  guestName?: string
  tableId?: string
  tableName?: string
  tableCapacity?: number
}

interface ResolvedPlan {
  rowIndex: number
  kind: SeatingKind
  guest?: GuestRecord
  targetKey?: string
  targetTable?: TableRecord
  tableName?: string
  requestedCapacity?: number
  tableOnly: boolean
}

const fields: FieldDefinition[] = [
  {
    key: 'guestId',
    label: 'Guest ID',
    required: false,
    type: 'string',
    description: 'Existing active-wedding Guest ID. Leave Guest ID and Guest Name blank for a table-only row.',
  },
  {
    key: 'guestName',
    label: 'Guest Name',
    required: false,
    type: 'string',
    example: 'Tendai Moyo',
    description: 'Existing Guest name. Duplicate names require Guest ID.',
  },
  {
    key: 'tableId',
    label: 'Table ID',
    required: false,
    type: 'string',
    description: 'Existing active-wedding Table ID. Blank table fields on a Guest row explicitly unseat the Guest.',
  },
  {
    key: 'tableName',
    label: 'Table Name',
    required: false,
    type: 'string',
    example: 'Family Table 1',
    description: 'Use a table-only row to create or maintain an empty table. A Guest row can assign by unique table name.',
  },
  {
    key: 'tableCapacity',
    label: 'Table Capacity',
    required: false,
    type: 'number',
    example: '8',
    description: 'Whole number from 1 to 50. Leave blank on Guest rows unless creating or deliberately resizing the target table.',
  },
]

function clean(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/\u0000/g, '').replace(/\r/g, '').trim()
}

function norm(value: unknown): string {
  return clean(value).replace(/\s+/g, ' ').toLowerCase()
}

function parseCapacity(value: unknown): number | null {
  const source = clean(value)
  if (!source) return null
  const parsed = Number(source.replace(/,/g, ''))
  return Number.isInteger(parsed) ? parsed : null
}

function kindOf(row: Record<string, string>): SeatingKind {
  return clean(row.guestId) || clean(row.guestName) ? 'guest' : 'table'
}

function guestVirtualId(id: string): string {
  return `guest:${id}`
}

function tableVirtualId(id: string): string {
  return `table:${id}`
}

function actualId(virtualId: string, prefix: SeatingKind): string {
  const expected = `${prefix}:`
  if (!virtualId.startsWith(expected)) throw new Error(`Invalid ${prefix} worksheet record ID.`)
  return virtualId.slice(expected.length)
}

function plannedSeats(guest: GuestRecord): number {
  return 1 + (guest.rsvp?.plusOne ? 1 : 0) + (guest.rsvp?.kidsAttending ? guest.rsvp.kidsCount : 0)
}

function addError(errors: Map<number, string[]>, rowIndex: number, message: string): void {
  const current = errors.get(rowIndex) ?? []
  if (!current.includes(message)) current.push(message)
  errors.set(rowIndex, current)
}

function guestRows(existing: any[]): SeatingExisting[] {
  return existing.filter((record): record is SeatingExisting => record?.kind === 'guest')
}

function tableRows(existing: any[]): SeatingExisting[] {
  return existing.filter((record): record is SeatingExisting => record?.kind === 'table')
}

function resolveGuest(
  row: Record<string, string>,
  existing: any[],
): { guest?: GuestRecord; error?: string } {
  const candidates = guestRows(existing)
  const guestId = clean(row.guestId)
  const guestName = norm(row.guestName)
  if (guestId) {
    const match = candidates.find((candidate) => candidate.guest.id === guestId)
    if (!match) return { error: `Guest ID "${guestId}" was not found in the active wedding.` }
    if (guestName && norm(match.guest.name) !== guestName) {
      return { error: 'Guest ID and Guest Name refer to different records.' }
    }
    return { guest: match.guest }
  }
  const matches = candidates.filter((candidate) => norm(candidate.guest.name) === guestName)
  if (matches.length === 0) {
    return { error: 'Guest Name was not found in the active wedding. Seating imports do not create Guests.' }
  }
  if (matches.length > 1) {
    return { error: 'Guest Name is ambiguous. Add the Guest ID and try again.' }
  }
  return { guest: matches[0].guest }
}

function resolveTable(
  row: Record<string, string>,
  existing: any[],
): { table?: TableRecord; key?: string; name?: string; error?: string } {
  const candidates = tableRows(existing)
  const tableId = clean(row.tableId)
  const tableName = clean(row.tableName)
  if (tableId) {
    const match = candidates.find((candidate) => candidate.table.id === tableId)
    if (!match) return { error: `Table ID "${tableId}" was not found in the active wedding.` }
    if (tableName && norm(match.table.name) !== norm(tableName)) {
      return { error: 'Table ID and Table Name refer to different records.' }
    }
    return { table: match.table, key: tableVirtualId(match.table.id), name: match.table.name }
  }
  if (!tableName) return {}
  const matches = candidates.filter((candidate) => norm(candidate.table.name) === norm(tableName))
  if (matches.length > 1) {
    return { error: 'Table Name is ambiguous. Add the Table ID and try again.' }
  }
  if (matches.length === 1) {
    return { table: matches[0].table, key: tableVirtualId(matches[0].table.id), name: matches[0].table.name }
  }
  return { key: `new-table:${norm(tableName)}`, name: tableName }
}

function validate(row: Record<string, string>): string[] {
  const errors: string[] = []
  const kind = kindOf(row)
  const guestIdentity = clean(row.guestId) || clean(row.guestName)
  const tableIdentity = clean(row.tableId) || clean(row.tableName)
  if (kind === 'guest' && !guestIdentity) errors.push('Guest ID or Guest Name is required for a Guest row.')
  if (kind === 'table' && !tableIdentity) errors.push('Provide a Guest row or a table-only row.')
  if (clean(row.tableCapacity)) {
    const capacity = parseCapacity(row.tableCapacity)
    if (capacity == null || capacity < 1 || capacity > MAX_CAPACITY) {
      errors.push(`Table Capacity must be a whole number from 1 to ${MAX_CAPACITY}.`)
    }
  }
  return errors
}

function rowToRecord(row: Record<string, string>): SeatingRecord {
  return {
    kind: kindOf(row),
    guestId: clean(row.guestId) || undefined,
    guestName: clean(row.guestName) || undefined,
    tableId: clean(row.tableId) || undefined,
    tableName: clean(row.tableName) || undefined,
    tableCapacity: clean(row.tableCapacity) ? parseCapacity(row.tableCapacity) ?? undefined : undefined,
  }
}

function recordToRow(record: SeatingExisting): Record<string, string> {
  if (record.kind === 'guest') {
    return {
      guestId: record.guest.id,
      guestName: record.guest.name,
      tableId: record.guest.seatingTable?.id ?? record.guest.seatingTableId ?? '',
      tableName: record.guest.seatingTable?.name ?? '',
      // Table-only rows are authoritative in full exports. A user can still put
      // capacity on a focused Guest assignment workbook when deliberately needed.
      tableCapacity: '',
    }
  }
  return {
    guestId: '',
    guestName: '',
    tableId: record.table.id,
    tableName: record.table.name,
    tableCapacity: String(record.table.capacity),
  }
}

function rowIdentity(row: Record<string, string>): string | null {
  if (kindOf(row) === 'guest') {
    const id = clean(row.guestId)
    if (id) return guestVirtualId(id)
    const name = norm(row.guestName)
    return name ? `guest-name:${name}` : null
  }
  const id = clean(row.tableId)
  if (id) return tableVirtualId(id)
  const name = norm(row.tableName)
  return name ? `table-name:${name}` : null
}

function matchExisting(row: Record<string, string>, existing: any[]): ExistingRecordMatch {
  if (kindOf(row) === 'guest') {
    const resolved = resolveGuest(row, existing)
    if (resolved.error) return { error: resolved.error }
    const record = guestRows(existing).find((candidate) => candidate.guest.id === resolved.guest?.id)
    return record ? { record } : { error: 'Guest was not found in the active wedding.' }
  }

  const resolved = resolveTable(row, existing)
  if (resolved.error) return { error: resolved.error }
  if (!resolved.table) return {}
  const record = tableRows(existing).find((candidate) => candidate.table.id === resolved.table?.id)
  return record ? { record } : {}
}

function rowDiffers(row: Record<string, string>, existing: SeatingExisting): boolean {
  if (existing.kind === 'table') {
    const name = clean(row.tableName)
    const capacity = clean(row.tableCapacity) ? parseCapacity(row.tableCapacity) : null
    return Boolean(
      (name && norm(name) !== norm(existing.table.name)) ||
      (capacity != null && capacity !== existing.table.capacity),
    )
  }

  const tableId = clean(row.tableId)
  const tableName = clean(row.tableName)
  let targetChanged = false
  if (tableId) targetChanged = existing.guest.seatingTableId !== tableId
  else if (tableName) targetChanged = norm(existing.guest.seatingTable?.name) !== norm(tableName)
  else targetChanged = existing.guest.seatingTableId !== null

  const capacity = clean(row.tableCapacity) ? parseCapacity(row.tableCapacity) : null
  const capacityChanged = capacity != null && capacity !== existing.guest.seatingTable?.capacity
  return targetChanged || capacityChanged
}

async function validateBatch(
  rows: PreviewBatchRow[],
  existing: any[],
  _weddingId: string,
): Promise<Map<number, string[]>> {
  const errors = new Map<number, string[]>()
  const plans: ResolvedPlan[] = []
  const seenGuestRows = new Map<string, number>()

  for (const { rowIndex, mapped } of rows) {
    const kind = kindOf(mapped)
    const requestedCapacity = clean(mapped.tableCapacity) ? parseCapacity(mapped.tableCapacity) ?? undefined : undefined
    if (kind === 'guest') {
      const resolvedGuest = resolveGuest(mapped, existing)
      if (resolvedGuest.error || !resolvedGuest.guest) {
        addError(errors, rowIndex, resolvedGuest.error ?? 'Guest was not found in the active wedding.')
        continue
      }
      const previousGuestRow = seenGuestRows.get(resolvedGuest.guest.id)
      if (previousGuestRow != null) {
        const message = 'This Guest appears more than once in the workbook. Keep one seating row per Guest.'
        addError(errors, previousGuestRow, message)
        addError(errors, rowIndex, message)
        continue
      }
      seenGuestRows.set(resolvedGuest.guest.id, rowIndex)

      const hasTarget = clean(mapped.tableId) || clean(mapped.tableName)
      if (!hasTarget) {
        plans.push({ rowIndex, kind, guest: resolvedGuest.guest, tableOnly: false })
        continue
      }
      const resolvedTable = resolveTable(mapped, existing)
      if (resolvedTable.error || !resolvedTable.key) {
        addError(errors, rowIndex, resolvedTable.error ?? 'Table could not be resolved.')
        continue
      }
      plans.push({
        rowIndex,
        kind,
        guest: resolvedGuest.guest,
        targetKey: resolvedTable.key,
        targetTable: resolvedTable.table,
        tableName: resolvedTable.name,
        requestedCapacity,
        tableOnly: false,
      })
      continue
    }

    const resolvedTable = resolveTable(mapped, existing)
    if (resolvedTable.error || !resolvedTable.key) {
      addError(errors, rowIndex, resolvedTable.error ?? 'Table ID or Table Name is required.')
      continue
    }
    plans.push({
      rowIndex,
      kind,
      targetKey: resolvedTable.key,
      targetTable: resolvedTable.table,
      tableName: resolvedTable.name,
      requestedCapacity,
      tableOnly: true,
    })
  }

  const byTarget = new Map<string, ResolvedPlan[]>()
  for (const plan of plans) {
    if (!plan.targetKey || errors.has(plan.rowIndex)) continue
    const current = byTarget.get(plan.targetKey) ?? []
    current.push(plan)
    byTarget.set(plan.targetKey, current)
  }

  for (const [targetKey, targetPlans] of byTarget) {
    if (targetKey.startsWith('new-table:')) {
      const hasTableOnly = targetPlans.some((plan) => plan.tableOnly)
      const hasGuest = targetPlans.some((plan) => !plan.tableOnly)
      if (hasTableOnly && hasGuest) {
        for (const plan of targetPlans) {
          addError(
            errors,
            plan.rowIndex,
            'A new table cannot be both a table-only row and a Guest assignment in the same workbook. Use Guest rows to create-and-assign, or import the empty table first.',
          )
        }
      }
    }

    const requested = [...new Set(targetPlans
      .map((plan) => plan.requestedCapacity)
      .filter((capacity): capacity is number => capacity != null))]
    if (requested.length > 1) {
      for (const plan of targetPlans) {
        addError(errors, plan.rowIndex, 'Conflicting capacities were supplied for the same table.')
      }
    }
  }

  const targetedGuests = new Set(plans.filter((plan) => plan.guest).map((plan) => plan.guest!.id))
  const occupied = new Map<string, number>()
  for (const candidate of guestRows(existing)) {
    const guest = candidate.guest
    if (!guest.seatingTableId || targetedGuests.has(guest.id)) continue
    const key = tableVirtualId(guest.seatingTableId)
    occupied.set(key, (occupied.get(key) ?? 0) + plannedSeats(guest))
  }
  for (const plan of plans) {
    if (!plan.guest || !plan.targetKey || errors.has(plan.rowIndex)) continue
    occupied.set(plan.targetKey, (occupied.get(plan.targetKey) ?? 0) + plannedSeats(plan.guest))
  }

  for (const [targetKey, targetPlans] of byTarget) {
    if (targetPlans.some((plan) => errors.has(plan.rowIndex))) continue
    const requested = targetPlans
      .map((plan) => plan.requestedCapacity)
      .find((capacity): capacity is number => capacity != null)
    const existingCapacity = targetPlans.find((plan) => plan.targetTable)?.targetTable?.capacity
    const capacity = requested ?? existingCapacity ?? DEFAULT_CAPACITY
    const seats = occupied.get(targetKey) ?? 0
    if (seats > capacity) {
      for (const plan of targetPlans) {
        addError(errors, plan.rowIndex, `Table capacity ${capacity} is below the planned occupancy of ${seats}.`)
      }
    }
  }

  return errors
}

async function fetchExisting(weddingId: string): Promise<SeatingExisting[]> {
  const [guests, tables] = await Promise.all([
    db.guest.findMany({
      where: { weddingId },
      include: { rsvp: true, seatingTable: true },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    }),
    db.seatingTable.findMany({
      where: { weddingId },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    }),
  ])
  return [
    ...guests.map((guest) => ({ id: guestVirtualId(guest.id), kind: 'guest' as const, guest })),
    ...tables.map((table) => ({ id: tableVirtualId(table.id), kind: 'table' as const, table })),
  ]
}

async function findTable(
  client: any,
  weddingId: string,
  record: SeatingRecord,
): Promise<TableRecord | null> {
  if (record.tableId) {
    const table = await client.seatingTable.findFirst({ where: { id: record.tableId, weddingId } })
    if (!table) throw new Error('Table does not belong to the active wedding.')
    if (record.tableName && norm(table.name) !== norm(record.tableName)) {
      throw new Error('Table ID and Table Name refer to different records.')
    }
    return table
  }
  if (!record.tableName) return null
  const tables = await client.seatingTable.findMany({ where: { weddingId } })
  const matches = tables.filter((table: TableRecord) => norm(table.name) === norm(record.tableName))
  if (matches.length > 1) throw new Error('Table Name is ambiguous. Add the Table ID.')
  return matches[0] ?? null
}

async function upsert(
  weddingId: string,
  record: SeatingRecord,
  existing?: SeatingExisting,
  context?: ImportExecutionContext,
): Promise<any> {
  const client = context?.db ?? db

  if (record.kind === 'table') {
    let table = existing?.kind === 'table' ? existing.table : await findTable(client, weddingId, record)
    if (table) {
      const data: Record<string, unknown> = {}
      if (record.tableName) data.name = record.tableName
      if (record.tableCapacity != null) data.capacity = record.tableCapacity
      if (Object.keys(data).length) table = await client.seatingTable.update({ where: { id: table.id }, data })
    } else {
      if (record.tableId) throw new Error('Table does not belong to the active wedding.')
      if (!record.tableName) throw new Error('Table Name is required to create a table.')
      table = await client.seatingTable.create({
        data: {
          weddingId,
          name: record.tableName,
          capacity: record.tableCapacity ?? DEFAULT_CAPACITY,
        },
      })
    }
    return { id: tableVirtualId(table.id), kind: 'table', table }
  }

  if (!existing || existing.kind !== 'guest') {
    throw new Error('Seating imports require an existing active-wedding Guest.')
  }
  const guest = await client.guest.findFirst({
    where: { id: existing.guest.id, weddingId },
    include: { rsvp: true, seatingTable: true },
  })
  if (!guest) throw new Error('Guest does not belong to the active wedding.')

  if (!record.tableId && !record.tableName) {
    const updated = await client.guest.update({
      where: { id: guest.id },
      data: { seatingTableId: null },
      include: { rsvp: true, seatingTable: true },
    })
    return { id: guestVirtualId(updated.id), kind: 'guest', guest: updated }
  }

  let table = await findTable(client, weddingId, record)
  let targetTableCreated = false
  if (!table) {
    if (!record.tableName) throw new Error('Table Name is required to create the target table.')
    table = await client.seatingTable.create({
      data: {
        weddingId,
        name: record.tableName,
        capacity: record.tableCapacity ?? DEFAULT_CAPACITY,
      },
    })
    targetTableCreated = true
  }

  const capacity = record.tableCapacity ?? table.capacity
  const assigned = await client.guest.findMany({
    where: { weddingId, seatingTableId: table.id },
    include: { rsvp: true },
  })
  const occupiedWithoutGuest = assigned
    .filter((candidate: GuestRecord) => candidate.id !== guest.id)
    .reduce((sum: number, candidate: GuestRecord) => sum + plannedSeats(candidate), 0)
  if (occupiedWithoutGuest + plannedSeats(guest) > capacity) {
    throw new Error(`Table capacity ${capacity} cannot accommodate this Guest party.`)
  }
  if (capacity !== table.capacity) {
    table = await client.seatingTable.update({ where: { id: table.id }, data: { capacity } })
  }
  const updated = await client.guest.update({
    where: { id: guest.id },
    data: { seatingTableId: table.id },
    include: { rsvp: true, seatingTable: true },
  })
  return {
    id: guestVirtualId(updated.id),
    kind: 'guest',
    guest: updated,
    __rollbackPatch: { targetTableId: table.id, targetTableCreated },
  }
}

async function captureRollbackSnapshot(
  weddingId: string,
  existing: SeatingExisting,
  record: SeatingRecord,
): Promise<any> {
  if (existing.kind === 'table') return { kind: 'table', table: { ...existing.table } }
  const targetTable = record.tableId || record.tableName
    ? await findTable(db, weddingId, record)
    : null
  return {
    kind: 'guest',
    guest: {
      id: existing.guest.id,
      seatingTableId: existing.guest.seatingTableId,
      tableNumber: existing.guest.tableNumber,
    },
    targetTable: targetTable ? { ...targetTable } : null,
  }
}

function requireOne(count: number, label: string): void {
  if (count !== 1) throw new Error(`${label} was not found in the active wedding.`)
}

async function deleteCreated(
  weddingId: string,
  virtualId: string,
  context?: ImportExecutionContext,
): Promise<void> {
  const client = context?.db ?? db
  const tableId = actualId(virtualId, 'table')
  const assigned = await client.guest.count({ where: { weddingId, seatingTableId: tableId } })
  if (assigned > 0) throw new Error('Created table still has assigned Guests and cannot be rolled back safely.')
  const deleted = await client.seatingTable.deleteMany({ where: { id: tableId, weddingId } })
  requireOne(deleted.count, 'Created table')
}

async function restoreUpdated(
  weddingId: string,
  virtualId: string,
  snapshot: any,
  context?: ImportExecutionContext,
): Promise<void> {
  const client = context?.db ?? db
  if (snapshot.kind === 'table') {
    const tableId = actualId(virtualId, 'table')
    const table = snapshot.table
    const restored = await client.seatingTable.updateMany({
      where: { id: tableId, weddingId },
      data: { name: table.name, capacity: table.capacity, position: table.position },
    })
    requireOne(restored.count, 'Seating rollback table')
    return
  }

  const guestId = actualId(virtualId, 'guest')
  const restoredGuest = await client.guest.updateMany({
    where: { id: guestId, weddingId },
    data: {
      seatingTableId: snapshot.guest.seatingTableId,
      tableNumber: snapshot.guest.tableNumber,
    },
  })
  requireOne(restoredGuest.count, 'Seating rollback Guest')

  if (snapshot.targetTable) {
    const table = snapshot.targetTable
    const restoredTable = await client.seatingTable.updateMany({
      where: { id: table.id, weddingId },
      data: { name: table.name, capacity: table.capacity, position: table.position },
    })
    requireOne(restoredTable.count, 'Seating rollback target table')
  } else if (snapshot.targetTableCreated && snapshot.targetTableId) {
    const assigned = await client.guest.count({
      where: { weddingId, seatingTableId: snapshot.targetTableId },
    })
    if (assigned === 0) {
      await client.seatingTable.deleteMany({
        where: { id: snapshot.targetTableId, weddingId },
      })
    }
  }
}

export const seatingWorksheetSchema: ModuleSchema = {
  key: 'seating',
  name: 'Seating',
  description: 'Existing Guest assignments and table records aligned with the planner Seating workspace.',
  version: '1.1.0',
  fields,
  rowToRecord,
  recordToRow: (record) => recordToRow(record as SeatingExisting),
  validateRow: validate,
  validateBatch,
  rowIdentity,
  matchExisting,
  rowDiffers: (row, existing) => rowDiffers(row, existing as SeatingExisting),
  fetchExisting,
  upsert,
  captureRollbackSnapshot,
  deleteCreated,
  restoreUpdated,
}
