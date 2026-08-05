import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  inferSeatingTableType,
  isSeatingTableType,
  parseSeatingTableMetadata,
  plannedSeatsForGuest,
  serializeSeatingTableMetadata,
} from '@/lib/planner-seating-metadata'
import {
  runSerializableSeatingTransaction,
  SeatingCapacityError,
  SeatingTargetError,
} from '@/lib/planner-seating-transaction'
import { requireWeddingPermission } from '@/lib/wedding-access'

const GUEST_ROLES = ['guest', 'bridal_party', 'family', 'officiant', 'vip'] as const
const GUEST_SIDES = ['bride', 'groom', 'family', 'neutral'] as const
const MAX_TABLE_CAPACITY = 50
const MAX_BULK_GUESTS = 500

function formatGuest(g: {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  roleDetail: string | null
  side: string | null
  tableNumber: number | null
  seatingTableId: string | null
  seatingTable: { id: string; name: string; capacity: number } | null
  weddingId: string
  createdAt: Date
  updatedAt: Date
  rsvp: {
    id: string
    token: string
    attending: boolean | null
    mealChoice: string | null
    plusOne: boolean
    plusOneName: string | null
    plusOneMeal: string | null
    kidsAttending: boolean
    kidsCount: number
    dietaryNotes: string | null
    message: string | null
    checkedIn: boolean
    checkedInAt: Date | null
    createdAt: Date
    updatedAt: Date
  } | null
}) {
  return {
    id: g.id,
    name: g.name,
    email: g.email,
    phone: g.phone,
    role: g.role,
    roleDetail: g.roleDetail,
    side: g.side,
    tableNumber: g.tableNumber,
    seatingTableId: g.seatingTableId,
    seatingTableName: g.seatingTable?.name ?? null,
    weddingId: g.weddingId,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    rsvp: g.rsvp
      ? {
          ...g.rsvp,
          checkedInAt: g.rsvp.checkedInAt?.toISOString() ?? null,
          createdAt: g.rsvp.createdAt.toISOString(),
          updatedAt: g.rsvp.updatedAt.toISOString(),
        }
      : null,
  }
}

function formatTable(table: {
  id: string
  name: string
  capacity: number
  position: string | null
  weddingId: string
  createdAt: Date
  updatedAt: Date
}) {
  const metadata = parseSeatingTableMetadata(table.position, table.name)
  return {
    ...table,
    tableType: metadata.tableType,
    zone: metadata.zone,
    notes: metadata.notes,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
  }
}

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const result = value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()
  return result ? result.slice(0, maxLength) : null
}

function parseCapacity(value: unknown, fallback = 8): number | null {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) return null
  if (value < 1 || value > MAX_TABLE_CAPACITY) return null
  return value
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return access.error

  try {
    const [guests, tables] = await Promise.all([
      db.guest.findMany({
        where: { weddingId: access.context.weddingId },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
        orderBy: [{ side: 'asc' }, { name: 'asc' }],
      }),
      db.seatingTable.findMany({
        where: { weddingId: access.context.weddingId },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({
      success: true,
      count: guests.length,
      data: guests.map(formatGuest),
      tables: tables.map(formatTable),
    })
  } catch (error) {
    console.error('[planner guests GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch guests.' }, { status: 500 })
  }
}

interface CreateGuestPayload {
  kind?: 'guest' | 'table'
  name?: string
  email?: string
  phone?: string
  role?: string
  roleDetail?: string
  side?: string
  seatingTableId?: string
  tableName?: string
  capacity?: number
  position?: string
  tableType?: string
  zone?: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateGuestPayload
    const access = await requireWeddingPermission(
      request,
      body.kind === 'table' ? 'seating.edit' : 'guests.edit',
    )
    if (access.error) return access.error
    const weddingId = access.context.weddingId

    if (body.kind === 'table') {
      const tableName = clean(body.tableName, 120) ?? ''
      if (!tableName) {
        return NextResponse.json({ success: false, error: 'Table name is required.' }, { status: 400 })
      }
      const duplicate = await db.seatingTable.findFirst({
        where: { weddingId, name: { equals: tableName, mode: 'insensitive' } },
        select: { id: true },
      })
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'A table with this name already exists for the active wedding.' },
          { status: 409 },
        )
      }
      const capacity = parseCapacity(body.capacity)
      if (capacity == null) {
        return NextResponse.json(
          { success: false, error: `Table capacity must be a whole number from 1 to ${MAX_TABLE_CAPACITY}.` },
          { status: 400 },
        )
      }
      const zone = clean(body.zone ?? body.position, 120)
      const tableType = isSeatingTableType(body.tableType)
        ? body.tableType
        : inferSeatingTableType(tableName, zone)
      const position = serializeSeatingTableMetadata({
        tableType,
        zone,
        notes: clean(body.notes, 500),
      })
      const table = await db.$transaction(async (tx) => {
        const created = await tx.seatingTable.create({
          data: { name: tableName, capacity, position, weddingId },
        })
        await tx.auditEvent.create({
          data: {
            action: 'seating.table_create',
            resourceType: 'seating_table',
            resourceId: created.id,
            afterValue: JSON.stringify(formatTable(created)),
            weddingId,
            actorId: access.context.session.userId,
          },
        })
        return created
      })
      return NextResponse.json({ success: true, data: formatTable(table) }, { status: 201 })
    }

    const name = clean(body.name, 160) ?? ''
    if (!name) return NextResponse.json({ success: false, error: 'Name is required.' }, { status: 400 })
    const email = body.email?.trim().toLowerCase() || null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid email address.', field: 'email' },
        { status: 400 },
      )
    }
    if (email) {
      const duplicate = await db.guest.findFirst({ where: { weddingId, email: { equals: email, mode: 'insensitive' } } })
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'A guest with this email already exists for this wedding.', field: 'email' },
          { status: 409 },
        )
      }
    }

    const role = GUEST_ROLES.includes(body.role as (typeof GUEST_ROLES)[number]) ? body.role! : 'guest'
    const side = GUEST_SIDES.includes(body.side as (typeof GUEST_SIDES)[number]) ? body.side! : 'neutral'

    const guest = await runSerializableSeatingTransaction(async (tx) => {
      if (body.seatingTableId) {
        const table = await tx.seatingTable.findFirst({
          where: { id: body.seatingTableId, weddingId },
          include: { guests: { include: { rsvp: true } } },
        })
        if (!table) throw new SeatingTargetError('Invalid seatingTableId.')
        const occupied = table.guests.reduce((sum, guest) => sum + plannedSeatsForGuest(guest), 0)
        if (occupied + 1 > table.capacity) {
          throw new SeatingCapacityError(`${table.name} has no available seat for ${name}.`)
        }
      }

      const created = await tx.guest.create({
        data: {
          name,
          email,
          phone: clean(body.phone, 80),
          role,
          roleDetail: clean(body.roleDetail, 160),
          side,
          seatingTableId: body.seatingTableId || null,
          weddingId,
        },
      })
      await tx.rSVP.create({ data: { token: randomUUID(), guestId: created.id } })
      await tx.auditEvent.create({
        data: {
          action: 'guest.create',
          resourceType: 'guest',
          resourceId: created.id,
          afterValue: JSON.stringify({ name: created.name, email: created.email, role: created.role }),
          weddingId,
          actorId: access.context.session.userId,
        },
      })
      return tx.guest.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
      })
    })

    return NextResponse.json({ success: true, data: formatGuest(guest) }, { status: 201 })
  } catch (error) {
    if (error instanceof SeatingCapacityError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }
    if (error instanceof SeatingTargetError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    console.error('[planner guests POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create guest or table.' }, { status: 500 })
  }
}

interface BulkAssignmentPayload {
  kind?: 'bulk_assignment'
  guestIds?: string[]
  seatingTableId?: string | null
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'seating.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as BulkAssignmentPayload
    if (body.kind !== 'bulk_assignment') {
      return NextResponse.json({ success: false, error: 'Unsupported seating operation.' }, { status: 400 })
    }
    const guestIds = [...new Set((Array.isArray(body.guestIds) ? body.guestIds : []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0))]
    if (guestIds.length === 0 || guestIds.length > MAX_BULK_GUESTS) {
      return NextResponse.json(
        { success: false, error: `Select between 1 and ${MAX_BULK_GUESTS} guests.` },
        { status: 400 },
      )
    }
    const weddingId = access.context.weddingId

    const updatedGuests = await runSerializableSeatingTransaction(async (tx) => {
      const guests = await tx.guest.findMany({
        where: { weddingId, id: { in: guestIds } },
        include: { rsvp: true },
      })
      if (guests.length !== guestIds.length) {
        throw new Error('One or more selected Guests were not found in the active wedding.')
      }

      if (body.seatingTableId) {
        const table = await tx.seatingTable.findFirst({
          where: { id: body.seatingTableId, weddingId },
        })
        if (!table) throw new Error('The destination table was not found in the active wedding.')
        const otherGuests = await tx.guest.findMany({
          where: {
            weddingId,
            seatingTableId: table.id,
            id: { notIn: guestIds },
          },
          include: { rsvp: true },
        })
        const occupied = otherGuests.reduce((sum, guest) => sum + plannedSeatsForGuest(guest), 0)
        const moving = guests.reduce((sum, guest) => sum + plannedSeatsForGuest(guest), 0)
        if (occupied + moving > table.capacity) {
          throw new SeatingCapacityError(
            `${table.name} has ${Math.max(0, table.capacity - occupied)} available seat${table.capacity - occupied === 1 ? '' : 's'}; the selected parties require ${moving}.`,
          )
        }
      }

      await tx.guest.updateMany({
        where: { weddingId, id: { in: guestIds } },
        data: { seatingTableId: body.seatingTableId || null },
      })
      await tx.auditEvent.create({
        data: {
          action: body.seatingTableId ? 'seating.guests_move' : 'seating.guests_unassign',
          resourceType: 'guest_batch',
          resourceId: guestIds.join(','),
          beforeValue: JSON.stringify(guests.map((guest) => ({ id: guest.id, seatingTableId: guest.seatingTableId }))),
          afterValue: JSON.stringify({ guestIds, seatingTableId: body.seatingTableId || null }),
          weddingId,
          actorId: access.context.session.userId,
        },
      })
      return tx.guest.findMany({
        where: { weddingId, id: { in: guestIds } },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
        orderBy: { name: 'asc' },
      })
    })

    return NextResponse.json({ success: true, count: updatedGuests.length, data: updatedGuests.map(formatGuest) })
  } catch (error) {
    if (error instanceof SeatingCapacityError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to move selected Guests.'
    if (/active wedding|destination table|selected Guests/.test(message)) {
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
    console.error('[planner guests bulk PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to move selected Guests.' }, { status: 500 })
  }
}
