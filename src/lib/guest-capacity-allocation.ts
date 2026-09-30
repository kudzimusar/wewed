import 'server-only'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export const ATTENDANCE_ALLOCATIONS = ['bride', 'groom', 'shared', 'operational'] as const
export type AttendanceAllocation = (typeof ATTENDANCE_ALLOCATIONS)[number]

export const ATTENDANCE_ALLOCATION_LABEL: Record<AttendanceAllocation, string> = {
  bride: 'Bride',
  groom: 'Groom',
  shared: 'Shared',
  operational: 'Operational',
}

export const ATTENDANCE_ALLOCATION_CAPACITY_EXCEEDED = 'ATTENDANCE_ALLOCATION_CAPACITY_EXCEEDED'

export function normalizeAttendanceAllocation(value: unknown): AttendanceAllocation {
  return ATTENDANCE_ALLOCATIONS.includes(value as AttendanceAllocation)
    ? value as AttendanceAllocation
    : 'shared'
}

export class AttendanceAllocationCapacityError extends Error {
  readonly code = ATTENDANCE_ALLOCATION_CAPACITY_EXCEEDED
  constructor(
    readonly allocation: AttendanceAllocation,
    readonly registered: number,
    readonly hardLimit: number,
  ) {
    super(
      `${ATTENDANCE_ALLOCATION_LABEL[allocation]} allocation is full (${registered}/${hardLimit} registered). Increase the configured limit or move another Guest before adding this person.`,
    )
  }
}

type CapacityClient = Pick<
  Prisma.TransactionClient,
  'guest' | 'weddingAttendanceAllocationLimit'
>

export interface AttendanceAllocationUsage {
  allocation: AttendanceAllocation
  registered: number
  attending: number
  hardLimit: number | null
  warningAt: number | null
  remaining: number | null
  warning: boolean
}

export async function attendanceAllocationUsage(
  client: CapacityClient,
  weddingId: string,
  allocation: AttendanceAllocation,
): Promise<AttendanceAllocationUsage> {
  const [limit, registered, attending] = await Promise.all([
    client.weddingAttendanceAllocationLimit.findUnique({
      where: { weddingId_allocation: { weddingId, allocation } },
      select: { hardLimit: true, warningAt: true },
    }),
    client.guest.count({ where: { weddingId, attendanceAllocation: allocation } }),
    client.guest.count({
      where: {
        weddingId,
        attendanceAllocation: allocation,
        rsvp: { is: { attending: true } },
      },
    }),
  ])
  const hardLimit = limit?.hardLimit ?? null
  const warningAt = limit?.warningAt ?? null
  return {
    allocation,
    registered,
    attending,
    hardLimit,
    warningAt,
    remaining: hardLimit === null ? null : Math.max(0, hardLimit - registered),
    warning: warningAt !== null && registered >= warningAt,
  }
}

/**
 * Call from inside the same serializable transaction that performs the Guest write.
 * The caller supplies excludeGuestId when moving an existing Guest into another allocation.
 */
export async function assertAttendanceAllocationCapacity(
  client: CapacityClient,
  input: {
    weddingId: string
    allocation: AttendanceAllocation
    excludeGuestId?: string | null
  },
): Promise<AttendanceAllocationUsage> {
  const limit = await client.weddingAttendanceAllocationLimit.findUnique({
    where: {
      weddingId_allocation: {
        weddingId: input.weddingId,
        allocation: input.allocation,
      },
    },
    select: { hardLimit: true, warningAt: true },
  })

  const registered = await client.guest.count({
    where: {
      weddingId: input.weddingId,
      attendanceAllocation: input.allocation,
      ...(input.excludeGuestId ? { NOT: { id: input.excludeGuestId } } : {}),
    },
  })
  const projected = registered + 1

  if (limit?.hardLimit !== null && limit?.hardLimit !== undefined && projected > limit.hardLimit) {
    throw new AttendanceAllocationCapacityError(input.allocation, registered, limit.hardLimit)
  }

  const attending = await client.guest.count({
    where: {
      weddingId: input.weddingId,
      attendanceAllocation: input.allocation,
      rsvp: { is: { attending: true } },
      ...(input.excludeGuestId ? { NOT: { id: input.excludeGuestId } } : {}),
    },
  })

  return {
    allocation: input.allocation,
    registered: projected,
    attending,
    hardLimit: limit?.hardLimit ?? null,
    warningAt: limit?.warningAt ?? null,
    remaining:
      limit?.hardLimit === null || limit?.hardLimit === undefined
        ? null
        : Math.max(0, limit.hardLimit - projected),
    warning: limit?.warningAt !== null && limit?.warningAt !== undefined
      ? projected >= limit.warningAt
      : false,
  }
}

export async function loadAttendanceAllocationOverview(weddingId: string) {
  return Promise.all(
    ATTENDANCE_ALLOCATIONS.map((allocation) =>
      attendanceAllocationUsage(db as unknown as CapacityClient, weddingId, allocation),
    ),
  )
}
