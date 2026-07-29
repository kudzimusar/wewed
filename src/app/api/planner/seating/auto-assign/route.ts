import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { buildAutoAssignments } from '@/lib/planner-phase2'

function guestHeadcount(guest: {
  rsvp: { attending: boolean | null; plusOne: boolean; kidsAttending: boolean; kidsCount: number } | null
}) {
  return 1 + (guest.rsvp?.plusOne ? 1 : 0) + (guest.rsvp?.kidsAttending ? guest.rsvp.kidsCount : 0)
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'seating.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json().catch(() => ({}))) as { dryRun?: unknown }
    const dryRun = body.dryRun !== false
    const weddingId = access.context.weddingId

    const [tables, guests] = await Promise.all([
      db.seatingTable.findMany({
        where: { weddingId },
        include: { guests: { include: { rsvp: true } } },
        orderBy: { name: 'asc' },
      }),
      db.guest.findMany({
        where: {
          weddingId,
          seatingTableId: null,
          OR: [{ rsvp: null }, { rsvp: { attending: { not: false } } }],
        },
        include: { rsvp: true },
        orderBy: { name: 'asc' },
      }),
    ])

    const plan = buildAutoAssignments(
      tables.map((table) => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        occupied: table.guests
          .filter((guest) => guest.rsvp?.attending !== false)
          .reduce((sum, guest) => sum + guestHeadcount(guest), 0),
      })),
      guests.map((guest) => ({
        id: guest.id,
        name: guest.name,
        seatingTableId: guest.seatingTableId,
        headcount: guestHeadcount(guest),
      })),
    )

    const guestNames = new Map(guests.map((guest) => [guest.id, guest.name]))
    const tableNames = new Map(tables.map((table) => [table.id, table.name]))
    const preview = plan.assignments.map((assignment) => ({
      ...assignment,
      guestName: guestNames.get(assignment.guestId) ?? assignment.guestId,
      tableName: tableNames.get(assignment.tableId) ?? assignment.tableId,
    }))

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        assignmentCount: plan.assignments.length,
        unassignedCount: plan.unassignedGuestIds.length,
        assignments: preview,
        unassignedGuestIds: plan.unassignedGuestIds,
      })
    }

    await db.$transaction(
      plan.assignments.map((assignment) =>
        db.guest.updateMany({
          where: { id: assignment.guestId, weddingId, seatingTableId: null },
          data: { seatingTableId: assignment.tableId },
        }),
      ),
    )

    await db.auditEvent.create({
      data: {
        action: 'seating.auto_assign',
        resourceType: 'seating_plan',
        afterValue: JSON.stringify({
          assigned: plan.assignments.length,
          unassigned: plan.unassignedGuestIds.length,
        }),
        weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({
      success: true,
      dryRun: false,
      assignmentCount: plan.assignments.length,
      unassignedCount: plan.unassignedGuestIds.length,
      assignments: preview,
      unassignedGuestIds: plan.unassignedGuestIds,
    })
  } catch (error) {
    console.error('[seating auto-assign POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to auto-assign seating.' }, { status: 500 })
  }
}
