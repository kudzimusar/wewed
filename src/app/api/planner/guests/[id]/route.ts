import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

const GUEST_ROLES = ['guest', 'bridal_party', 'family', 'officiant', 'vip'] as const
const GUEST_SIDES = ['bride', 'groom', 'family', 'neutral'] as const

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
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const kind = new URL(request.url).searchParams.get('kind') === 'table' ? 'table' : 'guest'
    const access = await requireWeddingPermission(
      request,
      kind === 'table' ? 'seating.edit' : 'guests.edit'
    )
    if (access.error) return access.error

    if (kind === 'table') {
      const existing = await db.seatingTable.findFirst({
        where: { id, weddingId: access.context.weddingId },
      })
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Table not found' },
          { status: 404 }
        )
      }

      const body = (await request.json()) as PatchTablePayload
      const updates: Record<string, unknown> = {}
      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
          return NextResponse.json(
            { success: false, error: 'Table name cannot be empty' },
            { status: 400 }
          )
        }
        updates.name = body.name.trim()
      }
      if (body.capacity !== undefined) {
        if (typeof body.capacity !== 'number' || !Number.isFinite(body.capacity) || body.capacity <= 0) {
          return NextResponse.json(
            { success: false, error: 'capacity must be a positive number' },
            { status: 400 }
          )
        }
        updates.capacity = Math.min(50, Math.floor(body.capacity))
      }
      if (body.position !== undefined) updates.position = body.position || null

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { success: false, error: 'No updates provided' },
          { status: 400 }
        )
      }

      const updated = await db.seatingTable.update({
        where: { id: existing.id },
        data: updates,
      })
      return NextResponse.json({ success: true, data: formatTable(updated) })
    }

    const existing = await db.guest.findFirst({
      where: { id, weddingId: access.context.weddingId },
      include: {
        rsvp: true,
        seatingTable: { select: { id: true, name: true, capacity: true } },
      },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Guest not found' },
        { status: 404 }
      )
    }

    const body = (await request.json()) as PatchGuestPayload
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json(
          { success: false, error: 'Name cannot be empty' },
          { status: 400 }
        )
      }
      updates.name = body.name.trim()
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
            weddingId: access.context.weddingId,
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
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null
    if (body.role !== undefined) {
      if (!GUEST_ROLES.includes(body.role as (typeof GUEST_ROLES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid role. Allowed: ${GUEST_ROLES.join(', ')}` },
          { status: 400 }
        )
      }
      updates.role = body.role
    }
    if (body.roleDetail !== undefined) updates.roleDetail = body.roleDetail?.trim() || null
    if (body.side !== undefined) {
      if (!GUEST_SIDES.includes(body.side as (typeof GUEST_SIDES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid side. Allowed: ${GUEST_SIDES.join(', ')}` },
          { status: 400 }
        )
      }
      updates.side = body.side
    }
    if (body.seatingTableId !== undefined) {
      if (!body.seatingTableId) updates.seatingTableId = null
      else {
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
        updates.seatingTableId = body.seatingTableId
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }

    const updated = await db.guest.update({
      where: { id: existing.id },
      data: updates,
      include: {
        rsvp: true,
        seatingTable: { select: { id: true, name: true, capacity: true } },
      },
    })
    return NextResponse.json({ success: true, data: formatGuest(updated) })
  } catch (error) {
    console.error('[PLANNER GUEST PATCH] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update guest or table' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const kind = new URL(request.url).searchParams.get('kind') === 'table' ? 'table' : 'guest'
    const access = await requireWeddingPermission(
      request,
      kind === 'table' ? 'seating.edit' : 'guests.edit'
    )
    if (access.error) return access.error

    if (kind === 'table') {
      const existing = await db.seatingTable.findFirst({
        where: { id, weddingId: access.context.weddingId },
        select: { id: true },
      })
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Table not found' },
          { status: 404 }
        )
      }

      await db.$transaction([
        db.guest.updateMany({
          where: {
            seatingTableId: existing.id,
            weddingId: access.context.weddingId,
          },
          data: { seatingTableId: null },
        }),
        db.seatingTable.delete({ where: { id: existing.id } }),
      ])

      return NextResponse.json({
        success: true,
        data: { id, deleted: true, kind: 'table' },
      })
    }

    const existing = await db.guest.findFirst({
      where: { id, weddingId: access.context.weddingId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Guest not found' },
        { status: 404 }
      )
    }

    await db.$transaction([
      db.rSVP.deleteMany({ where: { guestId: existing.id } }),
      db.guest.delete({ where: { id: existing.id } }),
    ])

    return NextResponse.json({
      success: true,
      data: { id, deleted: true, kind: 'guest' },
    })
  } catch (error) {
    console.error('[PLANNER GUEST DELETE] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete guest or table' },
      { status: 500 }
    )
  }
}
