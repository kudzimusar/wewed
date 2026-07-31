import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

const GUEST_ROLES = ['guest', 'bridal_party', 'family', 'officiant', 'vip'] as const
const GUEST_SIDES = ['bride', 'groom', 'family', 'neutral'] as const

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
  return {
    ...table,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
  }
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
      const tableName = typeof body.tableName === 'string' ? body.tableName.trim() : ''
      if (!tableName) {
        return NextResponse.json({ success: false, error: 'Table name is required.' }, { status: 400 })
      }
      const capacity =
        typeof body.capacity === 'number' && Number.isFinite(body.capacity) && body.capacity > 0
          ? Math.min(50, Math.floor(body.capacity))
          : 8
      const table = await db.seatingTable.create({
        data: { name: tableName, capacity, position: body.position ?? null, weddingId },
      })
      await db.auditEvent.create({
        data: {
          action: 'seating.table_create',
          resourceType: 'seating_table',
          resourceId: table.id,
          afterValue: JSON.stringify({ name: table.name, capacity: table.capacity }),
          weddingId,
          actorId: access.context.session.userId,
        },
      })
      return NextResponse.json({ success: true, data: formatTable(table) }, { status: 201 })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
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
    if (body.seatingTableId) {
      const table = await db.seatingTable.findFirst({
        where: { id: body.seatingTableId, weddingId },
        select: { id: true },
      })
      if (!table) return NextResponse.json({ success: false, error: 'Invalid seatingTableId.' }, { status: 400 })
    }

    const guest = await db.$transaction(async (tx) => {
      const created = await tx.guest.create({
        data: {
          name,
          email,
          phone: body.phone?.trim() || null,
          role,
          roleDetail: body.roleDetail?.trim() || null,
          side,
          seatingTableId: body.seatingTableId || null,
          weddingId,
        },
      })
      await tx.rSVP.create({ data: { token: randomUUID(), guestId: created.id } })
      return tx.guest.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
      })
    })

    await db.auditEvent.create({
      data: {
        action: 'guest.create',
        resourceType: 'guest',
        resourceId: guest.id,
        afterValue: JSON.stringify({ name: guest.name, email: guest.email, role: guest.role }),
        weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({ success: true, data: formatGuest(guest) }, { status: 201 })
  } catch (error) {
    console.error('[planner guests POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create guest or table.' }, { status: 500 })
  }
}
