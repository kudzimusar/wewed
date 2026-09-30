import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  ATTENDANCE_ALLOCATIONS,
  ATTENDANCE_ALLOCATION_LABEL,
  loadAttendanceAllocationOverview,
  type AttendanceAllocation,
} from '@/lib/guest-capacity-allocation'

function noStore(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function parseLimit(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100000) return 'invalid'
  return value
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return access.error

  const data = await loadAttendanceAllocationOverview(access.context.weddingId)
  return noStore({ success: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return access.error

  const payload = (await request.json().catch(() => null)) as {
    limits?: Array<{ allocation?: unknown; hardLimit?: unknown; warningAt?: unknown }>
  } | null
  if (!payload || !Array.isArray(payload.limits)) {
    return noStore({ success: false, error: 'Provide attendance allocation limits.' }, 400)
  }

  const seen = new Set<string>()
  const requested: Array<{
    allocation: AttendanceAllocation
    hardLimit: number | null
    warningAt: number | null
  }> = []

  for (const row of payload.limits) {
    if (!ATTENDANCE_ALLOCATIONS.includes(row.allocation as AttendanceAllocation)) {
      return noStore({ success: false, error: 'Unknown attendance allocation.' }, 400)
    }
    const allocation = row.allocation as AttendanceAllocation
    if (seen.has(allocation)) {
      return noStore({ success: false, error: `Duplicate ${ATTENDANCE_ALLOCATION_LABEL[allocation]} allocation setting.` }, 400)
    }
    seen.add(allocation)

    const hardLimit = parseLimit(row.hardLimit)
    const warningAt = parseLimit(row.warningAt)
    if (hardLimit === 'invalid' || warningAt === 'invalid') {
      return noStore({ success: false, error: 'Allocation limits must be whole numbers from 0 to 100000, or blank for no limit.' }, 400)
    }
    if (hardLimit !== null && warningAt !== null && warningAt > hardLimit) {
      return noStore({
        success: false,
        error: `${ATTENDANCE_ALLOCATION_LABEL[allocation]} warning threshold cannot exceed its hard limit.`,
      }, 400)
    }
    requested.push({ allocation, hardLimit, warningAt })
  }

  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.weddingAttendanceAllocationLimit.findMany({
        where: { weddingId },
        orderBy: { allocation: 'asc' },
      })
      const before = existing.map((row) => ({
        allocation: row.allocation,
        hardLimit: row.hardLimit,
        warningAt: row.warningAt,
      }))

      for (const row of requested) {
        const registered = await tx.guest.count({
          where: { weddingId, attendanceAllocation: row.allocation },
        })
        if (row.hardLimit !== null && registered > row.hardLimit) {
          throw new Error(`CAPACITY_CONFIG_CONFLICT:${row.allocation}:${registered}:${row.hardLimit}`)
        }

        if (row.hardLimit === null && row.warningAt === null) {
          await tx.weddingAttendanceAllocationLimit.deleteMany({
            where: { weddingId, allocation: row.allocation },
          })
          continue
        }

        await tx.weddingAttendanceAllocationLimit.upsert({
          where: { weddingId_allocation: { weddingId, allocation: row.allocation } },
          update: { hardLimit: row.hardLimit, warningAt: row.warningAt },
          create: {
            weddingId,
            allocation: row.allocation,
            hardLimit: row.hardLimit,
            warningAt: row.warningAt,
          },
        })
      }

      await tx.auditEvent.create({
        data: {
          action: 'guest.attendance_allocation_limits_updated',
          resourceType: 'wedding',
          resourceId: weddingId,
          beforeValue: JSON.stringify(before),
          afterValue: JSON.stringify(requested),
          weddingId,
          actorId,
        },
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('CAPACITY_CONFIG_CONFLICT:')) {
      const [, allocation, registered, hardLimit] = message.split(':')
      const label = ATTENDANCE_ALLOCATION_LABEL[allocation as AttendanceAllocation] ?? allocation
      return noStore({
        success: false,
        code: 'ATTENDANCE_ALLOCATION_LIMIT_BELOW_REGISTERED',
        error: `${label} already has ${registered} registered people, so its hard limit cannot be reduced to ${hardLimit}.`,
      }, 409)
    }
    console.error('[attendance allocation limits PUT] failed', error)
    return noStore({ success: false, error: 'Unable to save attendance allocation limits.' }, 500)
  }

  return noStore({
    success: true,
    data: await loadAttendanceAllocationOverview(weddingId),
  })
}
