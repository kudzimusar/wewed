import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { plannedSeatsForGuest } from '@/lib/planner-seating-metadata'
import {
  assertAttendanceAllocationCapacity,
  AttendanceAllocationCapacityError,
  normalizeAttendanceAllocation,
  type AttendanceAllocation,
} from '@/lib/guest-capacity-allocation'
import {
  runSerializableSeatingTransaction,
  SeatingCapacityError,
  SeatingTargetError,
} from '@/lib/planner-seating-transaction'

/**
 * NATIVE-MOBILE-QRO08 — the ONE implementation of Planner guest create / update / delete (guest
 * mode; seating tables stay in the desktop route). The desktop /api/planner/guests routes and the
 * native /api/native/wedding/guests routes both call these, so validation, duplicate-email rules,
 * seating capacity, the personal-link RSVP row and the audit trail are identical for both clients.
 *
 * Callers format the returned record themselves. The record includes the RSVP row (and therefore
 * the Guest's private invitation token); a caller must never forward it to a client that should
 * not hold credentials.
 */

export const PLANNER_GUEST_ROLES = ['guest', 'bridal_party', 'family', 'officiant', 'vip'] as const
export const PLANNER_GUEST_SIDES = ['bride', 'groom', 'family', 'neutral'] as const

export interface PlannerGuestActor {
  weddingId: string
  actorId: string
}

export interface CreatePlannerGuestInput {
  name?: string
  email?: string
  phone?: string
  role?: string
  roleDetail?: string
  side?: string
  attendanceAllocation?: string
  seatingTableId?: string
}

export interface UpdatePlannerGuestInput {
  name?: string
  email?: string | null
  phone?: string | null
  role?: string
  roleDetail?: string | null
  side?: string
  attendanceAllocation?: string
  seatingTableId?: string | null
}

export type GuestOperationResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; field?: string }

const guestInclude = {
  rsvp: true,
  seatingTable: { select: { id: true, name: true, capacity: true } },
} as const

export function cleanGuestText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const result = value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()
  return result ? result.slice(0, maxLength) : null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function seatingFailure(error: unknown): { ok: false; status: number; error: string } | null {
  if (error instanceof SeatingCapacityError) return { ok: false, status: 409, error: error.message }
  if (error instanceof SeatingTargetError) return { ok: false, status: 400, error: error.message }
  if (error instanceof AttendanceAllocationCapacityError) {
    return { ok: false, status: 409, error: error.message, code: error.code, field: 'attendanceAllocation' } as const
  }
  return null
}

export async function createPlannerGuest(actor: PlannerGuestActor, body: CreatePlannerGuestInput) {
  const { weddingId } = actor
  const name = cleanGuestText(body.name, 160) ?? ''
  if (!name) return { ok: false, status: 400, error: 'Name is required.' } as const
  const email = body.email?.trim().toLowerCase() || null
  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, status: 400, error: 'Enter a valid email address.', field: 'email' } as const
  }
  if (email) {
    const duplicate = await db.guest.findFirst({ where: { weddingId, email: { equals: email, mode: 'insensitive' } } })
    if (duplicate) {
      return { ok: false, status: 409, error: 'A guest with this email already exists for this wedding.', field: 'email' } as const
    }
  }

  const role = PLANNER_GUEST_ROLES.includes(body.role as (typeof PLANNER_GUEST_ROLES)[number]) ? body.role! : 'guest'
  const side = PLANNER_GUEST_SIDES.includes(body.side as (typeof PLANNER_GUEST_SIDES)[number]) ? body.side! : 'neutral'
  const attendanceAllocation = normalizeAttendanceAllocation(body.attendanceAllocation)

  try {
    const guest = await runSerializableSeatingTransaction(async (tx) => {
      const capacity = await assertAttendanceAllocationCapacity(tx, {
        weddingId,
        allocation: attendanceAllocation,
      })
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
          phone: cleanGuestText(body.phone, 80),
          role,
          roleDetail: cleanGuestText(body.roleDetail, 160),
          side,
          attendanceAllocation,
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
          afterValue: JSON.stringify({
            name: created.name,
            email: created.email,
            role: created.role,
            attendanceAllocation: created.attendanceAllocation,
            capacityWarning: capacity.warning,
            capacityRegistered: capacity.registered,
            capacityHardLimit: capacity.hardLimit,
          }),
          weddingId,
          actorId: actor.actorId,
        },
      })
      return tx.guest.findUniqueOrThrow({ where: { id: created.id }, include: guestInclude })
    })
    return { ok: true, status: 201, data: guest } as const
  } catch (error) {
    const failure = seatingFailure(error)
    if (failure) return failure
    throw error
  }
}

export async function updatePlannerGuest(actor: PlannerGuestActor, guestId: string, body: UpdatePlannerGuestInput) {
  const { weddingId } = actor
  const existing = await db.guest.findFirst({ where: { id: guestId, weddingId }, include: guestInclude })
  if (!existing) return { ok: false, status: 404, error: 'Guest not found' } as const

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = cleanGuestText(body.name, 160)
    if (!name) return { ok: false, status: 400, error: 'Name cannot be empty' } as const
    updates.name = name
  }
  if (body.email !== undefined) {
    const email = body.email?.trim().toLowerCase() || null
    if (email && !EMAIL_PATTERN.test(email)) {
      return { ok: false, status: 400, error: 'Enter a valid email address.', field: 'email' } as const
    }
    if (email) {
      const duplicate = await db.guest.findFirst({
        where: { weddingId, email: { equals: email, mode: 'insensitive' }, NOT: { id: existing.id } },
        select: { id: true },
      })
      if (duplicate) {
        return { ok: false, status: 409, error: 'A guest with this email already exists for this wedding.', field: 'email' } as const
      }
    }
    updates.email = email
  }
  if (body.phone !== undefined) updates.phone = cleanGuestText(body.phone, 80)
  if (body.role !== undefined) {
    if (!PLANNER_GUEST_ROLES.includes(body.role as (typeof PLANNER_GUEST_ROLES)[number])) {
      return { ok: false, status: 400, error: `Invalid role. Allowed: ${PLANNER_GUEST_ROLES.join(', ')}` } as const
    }
    updates.role = body.role
  }
  if (body.roleDetail !== undefined) updates.roleDetail = cleanGuestText(body.roleDetail, 160)
  let nextAttendanceAllocation: AttendanceAllocation = normalizeAttendanceAllocation(existing.attendanceAllocation)
  if (body.attendanceAllocation !== undefined) {
    if (!['bride', 'groom', 'shared', 'operational'].includes(body.attendanceAllocation)) {
      return { ok: false, status: 400, error: 'Invalid attendance allocation. Allowed: bride, groom, shared, operational', field: 'attendanceAllocation' } as const
    }
    nextAttendanceAllocation = normalizeAttendanceAllocation(body.attendanceAllocation)
    updates.attendanceAllocation = nextAttendanceAllocation
  }
  if (body.side !== undefined) {
    if (!PLANNER_GUEST_SIDES.includes(body.side as (typeof PLANNER_GUEST_SIDES)[number])) {
      return { ok: false, status: 400, error: `Invalid side. Allowed: ${PLANNER_GUEST_SIDES.join(', ')}` } as const
    }
    updates.side = body.side
  }
  if (body.seatingTableId !== undefined) updates.seatingTableId = body.seatingTableId || null

  if (Object.keys(updates).length === 0) return { ok: false, status: 400, error: 'No updates provided' } as const

  try {
    const updated = await runSerializableSeatingTransaction(async (tx) => {
      const current = await tx.guest.findFirst({ where: { id: existing.id, weddingId }, include: guestInclude })
      if (!current) throw new SeatingTargetError('Guest not found')

      const capacity = body.attendanceAllocation !== undefined && nextAttendanceAllocation !== current.attendanceAllocation
        ? await assertAttendanceAllocationCapacity(tx, {
            weddingId,
            allocation: nextAttendanceAllocation,
            excludeGuestId: current.id,
          })
        : null

      if (body.seatingTableId) {
        const table = await tx.seatingTable.findFirst({
          where: { id: body.seatingTableId, weddingId },
          include: { guests: { where: { NOT: { id: current.id } }, include: { rsvp: true } } },
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

      const guest = await tx.guest.update({ where: { id: current.id }, data: updates, include: guestInclude })
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
            attendanceAllocation: current.attendanceAllocation,
            seatingTableId: current.seatingTableId,
          }),
          afterValue: JSON.stringify({
            name: guest.name,
            email: guest.email,
            phone: guest.phone,
            role: guest.role,
            side: guest.side,
            attendanceAllocation: guest.attendanceAllocation,
            capacityWarning: capacity?.warning ?? false,
            capacityRegistered: capacity?.registered ?? null,
            capacityHardLimit: capacity?.hardLimit ?? null,
            seatingTableId: guest.seatingTableId,
          }),
          weddingId,
          actorId: actor.actorId,
        },
      })
      return guest
    })
    return { ok: true, status: 200, data: updated } as const
  } catch (error) {
    const failure = seatingFailure(error)
    if (failure) return failure
    throw error
  }
}

/**
 * Records that make a Guest part of the wedding's permanent history. Deleting the Guest would either
 * fail on a RESTRICT foreign key (Wedding Pass credential, check-in, guest contribution) or silently
 * detach attribution (contributions' `guest_id` is SET NULL), so such a Guest is never deleted.
 */
export type ProtectedGuestRecord = 'wedding_pass' | 'check_in' | 'contribution'

export const GUEST_DELETE_CONFLICT = 'GUEST_DELETE_CONFLICT'

const PROTECTED_RECORD_LABELS: Record<ProtectedGuestRecord, string> = {
  wedding_pass: 'a Wedding Pass',
  check_in: 'check-in history',
  contribution: 'a gift or contribution',
}

export function guestDeleteConflictMessage(guestName: string, records: ProtectedGuestRecord[]): string {
  const parts = records.map((record) => PROTECTED_RECORD_LABELS[record])
  if (parts.length === 0) {
    return `${guestName} can't be deleted because Wewed keeps records linked to them for this wedding. ` +
      'To stop them attending, change their RSVP to "Not attending" instead.'
  }
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
  return `${guestName} can't be deleted because Wewed keeps their ${list} as part of this wedding's records. ` +
    'To stop them attending, change their RSVP to "Not attending" instead.'
}

type DeleteTx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

async function protectedGuestRecords(tx: DeleteTx, weddingId: string, guestId: string): Promise<ProtectedGuestRecord[]> {
  const [passes, checkIns, contribution] = await Promise.all([
    tx.weddingPassCredential.count({ where: { weddingId, guestId } }),
    tx.weddingCheckIn.count({ where: { weddingId, guestId } }),
    tx.guestContribution.count({ where: { guestId } }),
  ])
  // Contribution accounting lives in its own schema (guest_id ON DELETE SET NULL); only consult it
  // where that schema is installed.
  let contributors = 0
  const [schema] = await tx.$queryRawUnsafe<Array<{ present: boolean }>>(
    `SELECT to_regclass('wewed_contributions.contributors') IS NOT NULL AS present`,
  )
  if (schema?.present) {
    const [row] = await tx.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      'SELECT count(*) AS count FROM wewed_contributions.contributors WHERE guest_id = $1',
      guestId,
    )
    contributors = Number(row?.count ?? 0)
  }
  const records: ProtectedGuestRecord[] = []
  if (passes > 0) records.push('wedding_pass')
  if (checkIns > 0) records.push('check_in')
  if (contribution > 0 || contributors > 0) records.push('contribution')
  return records
}

class GuestDeleteConflict extends Error {
  constructor(readonly records: ProtectedGuestRecord[]) {
    super(GUEST_DELETE_CONFLICT)
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'P2003' || code === '23503'
}

/**
 * Destructive: removes the Guest, their RSVP (and personal link) and their disposable per-guest
 * state (worksheet metadata, pending install hand-offs cascade in the database).
 *
 * A Guest who is part of the wedding's history — a Wedding Pass, a check-in or a contribution — is
 * never deleted: the call returns 409 `GUEST_DELETE_CONFLICT` with a plain explanation and changes
 * nothing. Desktop and native Planner routes both surface this contract unchanged.
 */
export async function deletePlannerGuest(actor: PlannerGuestActor, guestId: string) {
  const { weddingId } = actor
  const existing = await db.guest.findFirst({ where: { id: guestId, weddingId }, include: { rsvp: true } })
  if (!existing) return { ok: false, status: 404, error: 'Guest not found' } as const

  try {
    await db.$transaction(async (tx) => {
      const records = await protectedGuestRecords(tx, weddingId, existing.id)
      if (records.length > 0) throw new GuestDeleteConflict(records)
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
          actorId: actor.actorId,
        },
      })
    })
  } catch (error) {
    // A record created between the check and the delete (e.g. a pass issued concurrently) still
    // resolves to the same deliberate conflict — never a database error surfaced as a 500.
    if (error instanceof GuestDeleteConflict || isForeignKeyViolation(error)) {
      const records = error instanceof GuestDeleteConflict
        ? error.records
        : await protectedGuestRecords(db as unknown as DeleteTx, weddingId, existing.id)
      return {
        ok: false,
        status: 409,
        code: GUEST_DELETE_CONFLICT,
        error: guestDeleteConflictMessage(existing.name, records),
        protectedRecords: records,
      } as const
    }
    throw error
  }
  return { ok: true, status: 200, data: { id: existing.id, deleted: true as const, kind: 'guest' as const } } as const
}
