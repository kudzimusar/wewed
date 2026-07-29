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

function formatTable(t: {
  id: string
  name: string
  capacity: number
  position: string | null
  weddingId: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
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
    console.error('[PLANNER GUESTS GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch guests' },
      { status: 500 }
    )
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
      body.kind === 'table' ? 'seating.edit' : 'guests.edit'
    )
    if (access.error) return access.error

    if (body.kind === 'table') {
      if (!body.tableName || typeof body.tableName !== 'string' || !body.tableName.trim()) {
        return NextResponse.json(
          { success: false, error: 'Table name is required' },
          { status: 400 }
        )
      }

      const capacity =
        typeof body.capacity === 'number' && Number.isFinite(body.capacity) && body.capacity > 0
          ? Math.min(50, Math.floor(body.capacity))
          : 8

      const table = await db.seatingTable.create({
        data: {
          name: body.tableName.trim(),
          capacity,
          position: body.position ?? null,
          weddingId: access.context.weddingId,
        },
      })

      return NextResponse.json(
        { success: true, data: formatTable(table) },
        { status: 201 }
      )
    }

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    const role = GUEST_ROLES.includes(body.role as (typeof GUEST_ROLES)[number])
      ? body.role!
      : 'guest'
    const side = GUEST_SIDES.includes(body.side as (typeof GUEST_SIDES)[number])
      ? body.side!
      : 'neutral'

    if (body.seatingTableId) {
      const table = await db.seatingTable.findFirst({
        where: {
          id: body.seatingTableId,
          weddingId: access.context.weddingId,
        },
        select: { id: true },
      })
      if (!table) {
        return NextResponse.json(
          { success: false, error: 'Invalid seatingTableId' },
          { status: 400 }
        )
      }
    }

    const guest = await db.guest.create({
      data: {
        name: body.name.trim(),
        email: body.email?.trim().toLowerCase() || null,
        phone: body.phone?.trim() || null,
        role,
        roleDetail: body.roleDetail?.trim() || null,
        side,
        seatingTableId: body.seatingTableId || null,
        weddingId: access.context.weddingId,
      },
      include: {
        rsvp: true,
        seatingTable: { select: { id: true, name: true, capacity: true } },
      },
    })

    return NextResponse.json(
      { success: true, data: formatGuest(guest) },
      { status: 201 }
    )
  } catch (error) {
    console.error('[PLANNER GUESTS POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create guest or table' },
      { status: 500 }
    )
  }
}
