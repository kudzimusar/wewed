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

interface PatchGuestPayload {
  name?: string
  email?: string | null
  phone?: string | null
  role?: string
  roleDetail?: string | null
  side?: string
  seatingTableId?: string | null
}

interface PatchTablePayload {
  name?: string
  capacity?: number
  position?: string | null
  tableType?: string
  zone?: string | null
  notes?: string | null
}

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const result = value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()
  return result ? result.slice(0, maxLength) : null
}

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

function formatTable(t: {
  id: string
  name: string
  capacity: number
  position: string | null
  weddingId: string
  createdAt: Date
  updatedAt: Date
}) {
  const metadata = parseSeatingTableMetadata(t.position, t.name)
  return {
    ...t,
    tableType: metadata.tableType,
    zone: metadata.zone,
    notes: metadata.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const kind = new URL(request.url).searchParams.get('kind') === 'table' ? 'table' : 'guest'
    const access = await requireWeddingPermission(
      request,
      kind === 'table' ? 'seating.edit' : 'guests.edit',
    )
    if (access.error) return access.error
    const weddingId = access.context.weddingId

    if (kind === 'table') {
      const existing = await db.seatingTable.findFirst({
        where: { id, weddingId },
        include: { guests: { include: { rsvp: true } } },
      })
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Table not found' }, { status: 404 })
      }

      const body = (await request.json()) as PatchTablePayload
      const updates: { name?: string; capacity?: number; position?: string | null } = {}
      let nextName = existing.name
      if (body.name !== undefined) {
        const name = clean(body.name, 120)
        if (!name) {
          return NextResponse.json({ success: false, error: 'Table name cannot be empty' }, { status: 400 })
        }
        const duplicate = await db.seatingTable.findFirst({
          where: {
            weddingId,
            name: { equals: name, mode: 'insensitive' },
            NOT: { id: existing.id },
          },
          select: { id: true },
        })
        if (duplicate) {
          return NextResponse.json(
            { success: false, error: 'A table with this name already exists for the active wedding.' },
            { status: 409 },
          )
        }
        nextName = name
        updates.name = name
      }

      if (body.capacity !== undefined) {
        if (
          typeof body.capacity !== 'number' ||
          !Number.isFinite(body.capacity) ||
          !Number.isInteger(body.capacity) ||
          body.capacity < 1 ||
          body.capacity > MAX_TABLE_CAPACITY
        ) {
          return NextResponse.json(
            { success: false, error: `Table capacity must be a whole number from 1 to ${MAX_TABLE_CAPACITY}.` },
            { status: 400 },
          )
        }
        const occupied = existing.guests.reduce((sum, guest) => sum + plannedSeatsForGuest(guest), 0)
        if (body.capacity < occupied) {
          return NextResponse.json(
            {
              success: false,
              error: `${existing.name} currently requires ${occupied} planned seats. Move or unassign Guests before reducing capacity below ${occupied}.`,
            },
            { status: 409 },
          )
        }
        updates.capacity = body.capacity
      }

      if (
        body.position !== undefined ||
        body.tableType !== undefined ||
        body.zone !== undefined ||
        body.notes !== undefined
      ) {
        const current = parseSeatingTableMetadata(existing.position, nextName)
        const legacyPosition = body.position !== undefined
          ? parseSeatingTableMetadata(body.position, nextName)
          : current
        const tableType = body.tableType !== undefined
          ? (isSeatingTableType(body.tableType)
              ? body.tableType
              : inferSeatingTableType(nextName, clean(body.zone, 120)))
          : legacyPosition.tableType
        updates.position = serializeSeatingTableMetadata({
          tableType,
          zone: body.zone !== undefined ? clean(body.zone, 120) : legacyPosition.zone,
          notes: body.notes !== undefined ? clean(body.notes, 500) : legacyPosition.notes,
          ...(legacyPosition.x !== undefined ? { x: legacyPosition.x } : {}),
          ...(legacyPosition.y !== undefined ? { y: legacyPosition.y } : {}),
        })
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 })
      }

      const updated = await runSerializableSeatingTransaction(async (tx) => {
        const current = await tx.seatingTable.findFirst({
          where: { id: existing.id, weddingId },
          include: { guests: { include: { rsvp: true } } },
        })
        if (!current) throw new SeatingTargetError('Table not found')
        if (updates.capacity !== undefined) {
          const occupied = current.guests.reduce((sum, guest) => sum + plannedSeatsForGuest(guest), 0)
          if (updates.capacity < occupied) {
            throw new SeatingCapacityError(
              `${current.name} currently requires ${occupied} planned seats. Move or unassign Guests before reducing capacity below ${occupied}.`,
            )
          }
        }
        const table = await tx.seatingTable.update({ where: { id: current.id }, data: updates })
        await tx.auditEvent.create({
          data: {
            action: 'seating.table_update',
            resourceType: 'seating_table',
            resourceId: current.id,
            beforeValue: JSON.stringify(formatTable(current)),
            afterValue: JSON.stringify(formatTable(table)),
            weddingId,
            actorId: access.context.session.userId,
          },
        })
        return table
      })
      return NextResponse.json({ success: true, data: formatTable(updated) })
    }

    const existing = await db.guest.findFirst({
      where: { id, weddingId },
      include: {
        rsvp: true,
        seatingTable: { select: { id: true, name: true, capacity: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 })
    }

    const body = (await request.json()) as PatchGuestPayload
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = clean(body.name, 160)
      if (!name) {
        return NextResponse.json({ success: false, error: 'Name cannot be empty' }, { status: 400 })
      }
      updates.name = name
    }
    if (body.email !== undefined) {
      const email = body.email?.trim().toLowerCase() || null
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { success: false, error: 'Enter a valid email address.', field: 'email' },
          { status: 400 },
        )
      }
      if (email) {
        const duplicate = await db.guest.findFirst({
          where: {
            weddingId,
            email: { equals: email, mode: 'insensitive' },
            NOT: { id: existing.id },
          },
          select: { id: true },
        })
        if (duplicate) {
          return NextResponse.json(
            { success: false, error: 'A guest with this email already exists for this wedding.', field: 'email' },
            { status: 409 },
          )
        }
      }
      updates.email = email
    }
    if (body.phone !== undefined) updates.phone = clean(body.phone, 80)
    if (body.role !== undefined) {
      if (!GUEST_ROLES.includes(body.role as (typeof GUEST_ROLES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid role. Allowed: ${GUEST_ROLES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.role = body.role
    }
    if (body.roleDetail !== undefined) updates.roleDetail = clean(body.roleDetail, 160)
    if (body.side !== undefined) {
      if (!GUEST_SIDES.includes(body.side as (typeof GUEST_SIDES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid side. Allowed: ${GUEST_SIDES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.side = body.side
    }
    if (body.seatingTableId !== undefined) {
      updates.seatingTableId = body.seatingTableId || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 })
    }

    const updated = await runSerializableSeatingTransaction(async (tx) => {
      const current = await tx.guest.findFirst({
        where: { id: existing.id, weddingId },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
      })
      if (!current) throw new SeatingTargetError('Guest not found')

      if (body.seatingTableId) {
        const table = await tx.seatingTable.findFirst({
          where: { id: body.seatingTableId, weddingId },
          include: {
            guests: {
              where: { NOT: { id: current.id } },
              include: { rsvp: true },
            },
          },
        })
        if (!table) throw new SeatingTargetError('Invalid seatingTableId')
        const occupied = table.guests.reduce((sum, guest) => sum + plannedSeatsForGuest(guest), 0)
        const required = plannedSeatsForGuest(current)
        if (occupied + required > table.capacity) {
          throw new SeatingCapacityError(
            `${table.name} has ${Math.max(0, table.capacity - occupied)} available seat${table.capacity - occupied === 1 ? '' : 's'}; ${current.name}'s party requires ${required}.`,
          )
        }
      }

      const guest = await tx.guest.update({
        where: { id: current.id },
        data: updates,
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
      })
      await tx.auditEvent.create({
        data: {
          action: body.seatingTableId !== undefined ? 'seating.guest_assignment' : 'guest.update',
          resourceType: 'guest',
          resourceId: current.id,
          beforeValue: JSON.stringify({
            name: current.name,
            email: current.email,
            phone: current.phone,
            role: current.role,
            side: current.side,
            seatingTableId: current.seatingTableId,
          }),
          afterValue: JSON.stringify({
            name: guest.name,
            email: guest.email,
            phone: guest.phone,
            role: guest.role,
            side: guest.side,
            seatingTableId: guest.seatingTableId,
          }),
          weddingId,
          actorId: access.context.session.userId,
        },
      })
      return guest
    })
    return NextResponse.json({ success: true, data: formatGuest(updated) })
  } catch (error) {
    if (error instanceof SeatingCapacityError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }
    if (error instanceof SeatingTargetError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    console.error('[PLANNER GUEST PATCH] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update guest or table' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const kind = new URL(request.url).searchParams.get('kind') === 'table' ? 'table' : 'guest'
    const access = await requireWeddingPermission(
      request,
      kind === 'table' ? 'seating.edit' : 'guests.edit',
    )
    if (access.error) return access.error
    const weddingId = access.context.weddingId

    if (kind === 'table') {
      const existing = await db.seatingTable.findFirst({
        where: { id, weddingId },
        include: { guests: { select: { id: true, name: true } } },
      })
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Table not found' }, { status: 404 })
      }

      await db.$transaction(async (tx) => {
        await tx.guest.updateMany({
          where: { seatingTableId: existing.id, weddingId },
          data: { seatingTableId: null },
        })
        await tx.seatingTable.delete({ where: { id: existing.id } })
        await tx.auditEvent.create({
          data: {
            action: 'seating.table_delete',
            resourceType: 'seating_table',
            resourceId: existing.id,
            beforeValue: JSON.stringify({
              ...formatTable(existing),
              unassignedGuests: existing.guests,
            }),
            afterValue: JSON.stringify({ deleted: true, unassignedGuestCount: existing.guests.length }),
            weddingId,
            actorId: access.context.session.userId,
          },
        })
      })

      return NextResponse.json({
        success: true,
        data: { id, deleted: true, kind: 'table', unassignedGuestCount: existing.guests.length },
      })
    }

    const existing = await db.guest.findFirst({
      where: { id, weddingId },
      include: { rsvp: true },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      await tx.rSVP.deleteMany({ where: { guestId: existing.id } })
      await tx.guest.delete({ where: { id: existing.id } })
      await tx.auditEvent.create({
        data: {
          action: 'guest.delete',
          resourceType: 'guest',
          resourceId: existing.id,
          beforeValue: JSON.stringify({
            name: existing.name,
            email: existing.email,
            seatingTableId: existing.seatingTableId,
          }),
          afterValue: JSON.stringify({ deleted: true }),
          weddingId,
          actorId: access.context.session.userId,
        },
      })
    })

    return NextResponse.json({ success: true, data: { id, deleted: true, kind: 'guest' } })
  } catch (error) {
    console.error('[PLANNER GUEST DELETE] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete guest or table' },
      { status: 500 },
    )
  }
}
