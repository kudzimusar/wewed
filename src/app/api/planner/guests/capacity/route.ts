import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ATTENDANCE_ALLOCATIONS,
  loadAttendanceAllocationOverview,
  normalizeAttendanceAllocation,
} from '@/lib/guest-capacity-allocation'
import { requireWeddingPermission } from '@/lib/wedding-access'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function integerOrNull(value: unknown): number | null | 'invalid' {
  if (value === null || value === '' || value === undefined) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return 'invalid'
  return value
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return noStore(access.error)
  const data = await loadAttendanceAllocationOverview(access.context.weddingId)
  return noStore(NextResponse.json({ success: true, data }))
}

export async function PUT(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return noStore(access.error)

  const body = (await request.json().catch(() => null)) as {
    allocation?: unknown
    hardLimit?: unknown
    warningAt?: unknown
  } | null
  if (!body || typeof body.allocation !== 'string' || !ATTENDANCE_ALLOCATIONS.includes(body.allocation as any)) {
    return noStore(NextResponse.json(
      { success: false, error: 'Choose Bride, Groom, Shared, or Operational allocation.' },
      { status: 400 },
    ))
  }

  const allocation = normalizeAttendanceAllocation(body.allocation)
  const hardLimit = integerOrNull(body.hardLimit)
  const warningAt = integerOrNull(body.warningAt)
  if (hardLimit === 'invalid' || warningAt === 'invalid') {
    return noStore(NextResponse.json(
      { success: false, error: 'Capacity limits must be whole numbers of zero or more.' },
      { status: 400 },
    ))
  }
  if (hardLimit !== null && warningAt !== null && warningAt > hardLimit) {
    return noStore(NextResponse.json(
      { success: false, error: 'Warning threshold cannot exceed the hard allocation limit.' },
      { status: 400 },
    ))
  }

  const registered = await db.guest.count({
    where: { weddingId: access.context.weddingId, attendanceAllocation: allocation },
  })
  if (hardLimit !== null && hardLimit < registered) {
    return noStore(NextResponse.json(
      {
        success: false,
        code: 'ATTENDANCE_ALLOCATION_CAPACITY_BELOW_CURRENT',
        error: `This allocation already has ${registered} registered Guests. Move Guests before reducing its hard limit below ${registered}.`,
      },
      { status: 409 },
    ))
  }

  await db.$transaction(async (tx) => {
    await tx.weddingAttendanceAllocationLimit.upsert({
      where: {
        weddingId_allocation: {
          weddingId: access.context.weddingId,
          allocation,
        },
      },
      create: {
        weddingId: access.context.weddingId,
        allocation,
        hardLimit,
        warningAt,
      },
      update: { hardLimit, warningAt },
    })
    await tx.auditEvent.create({
      data: {
        action: 'guest.attendance_allocation_capacity_updated',
        resourceType: 'wedding',
        resourceId: access.context.weddingId,
        afterValue: JSON.stringify({ allocation, hardLimit, warningAt, registered }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })
  })

  const data = await loadAttendanceAllocationOverview(access.context.weddingId)
  return noStore(NextResponse.json({ success: true, data }))
}
