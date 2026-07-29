import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const weddingId = access.context.weddingId
    const today = startOfUtcDay()
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const nextSevenDays = new Date(today)
    nextSevenDays.setUTCDate(nextSevenDays.getUTCDate() + 7)

    const [
      wedding,
      tasks,
      guests,
      tables,
      budget,
      vendors,
      timeline,
      reminders,
      imports,
      activity,
    ] = await Promise.all([
      db.wedding.findUnique({
        where: { id: weddingId },
        select: { id: true, title: true, date: true, venue: true, venueCity: true, lifecycle: true },
      }),
      db.plannerTask.findMany({
        where: { weddingId },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
      }),
      db.guest.findMany({
        where: { weddingId },
        include: { rsvp: true },
        orderBy: { name: 'asc' },
      }),
      db.seatingTable.findMany({
        where: { weddingId },
        include: { guests: { include: { rsvp: true } } },
        orderBy: { name: 'asc' },
      }),
      db.budgetItem.findMany({ where: { weddingId } }),
      db.vendor.findMany({ where: { weddingId }, orderBy: { name: 'asc' } }),
      db.programmeItem.findMany({
        where: { weddingId },
        orderBy: [{ order: 'asc' }, { time: 'asc' }],
      }),
      db.contentRevision.findMany({
        where: { weddingId, section: 'planner_reminder' },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
      }),
      db.importJob.findMany({
        where: { weddingId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.auditEvent.findMany({
        where: { weddingId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    if (!wedding) {
      return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })
    }

    const openTasks = tasks.filter((task) => task.status !== 'done')
    const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < today)
    const dueToday = openTasks.filter(
      (task) => task.dueDate && task.dueDate >= today && task.dueDate < tomorrow,
    )
    const dueSoon = openTasks.filter(
      (task) => task.dueDate && task.dueDate >= tomorrow && task.dueDate < nextSevenDays,
    )

    const confirmedGuests = guests.filter((guest) => guest.rsvp?.attending === true)
    const declinedGuests = guests.filter((guest) => guest.rsvp?.attending === false)
    const pendingGuests = guests.filter((guest) => !guest.rsvp || guest.rsvp.attending === null)
    const unseatedGuests = confirmedGuests.filter((guest) => !guest.seatingTableId)
    const guestHeads = (guest: (typeof guests)[number]) =>
      1 + (guest.rsvp?.plusOne ? 1 : 0) + (guest.rsvp?.kidsAttending ? guest.rsvp.kidsCount : 0)

    const estimated = budget.reduce((sum, item) => sum + item.estimatedCost, 0)
    const actual = budget.reduce((sum, item) => sum + (item.actualCost ?? item.estimatedCost), 0)
    const paid = budget.reduce((sum, item) => sum + item.paidAmount, 0)
    const outstanding = Math.max(0, actual - paid)

    const taskProgress = tasks.length
      ? tasks.filter((task) => task.status === 'done').length / tasks.length
      : 0
    const rsvpProgress = guests.length
      ? (confirmedGuests.length + declinedGuests.length) / guests.length
      : 0
    const seatingProgress = confirmedGuests.length
      ? confirmedGuests.filter((guest) => guest.seatingTableId).length / confirmedGuests.length
      : 0
    const budgetProgress = actual > 0 ? Math.min(1, paid / actual) : 0
    const readiness = Math.round(
      (taskProgress * 0.35 + rsvpProgress * 0.25 + seatingProgress * 0.2 + budgetProgress * 0.2) *
        100,
    )

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      wedding: {
        ...wedding,
        date: wedding.date.toISOString(),
      },
      readiness,
      tasks: {
        total: tasks.length,
        completed: tasks.filter((task) => task.status === 'done').length,
        open: openTasks.length,
        overdue: overdue.length,
        dueToday: dueToday.length,
        dueSoon: dueSoon.length,
        priority: [...overdue, ...dueToday, ...dueSoon].slice(0, 12).map((task) => ({
          ...task,
          dueDate: task.dueDate?.toISOString() ?? null,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        })),
      },
      guests: {
        total: guests.length,
        confirmed: confirmedGuests.length,
        declined: declinedGuests.length,
        pending: pendingGuests.length,
        unseated: unseatedGuests.length,
        confirmedHeads: confirmedGuests.reduce((sum, guest) => sum + guestHeads(guest), 0),
        withoutEmail: guests.filter((guest) => !guest.email?.trim()).length,
      },
      seating: {
        tables: tables.map((table) => {
          const occupied = table.guests
            .filter((guest) => guest.rsvp?.attending === true)
            .reduce((sum, guest) => sum + guestHeads(guest), 0)
          return {
            id: table.id,
            name: table.name,
            capacity: table.capacity,
            occupied,
            remaining: Math.max(0, table.capacity - occupied),
            overCapacity: occupied > table.capacity,
          }
        }),
        unseatedGuests: unseatedGuests.map((guest) => ({
          id: guest.id,
          name: guest.name,
          headcount: guestHeads(guest),
        })),
      },
      budget: {
        currency: budget[0]?.currency ?? 'USD',
        estimated,
        actual,
        paid,
        outstanding,
        overduePayments: budget.filter(
          (item) => item.dueDate && item.dueDate < today && item.paidAmount < (item.actualCost ?? item.estimatedCost),
        ).length,
      },
      vendors: {
        total: vendors.length,
        featured: vendors.filter((vendor) => vendor.featured).length,
      },
      timeline: timeline.slice(0, 12).map((item) => ({
        id: item.id,
        time: item.time,
        title: item.title,
        description: item.description,
        order: item.order,
      })),
      reminders: {
        total: reminders.length,
        scheduled: reminders.filter((reminder) => reminder.status === 'scheduled').length,
        sent: reminders.filter((reminder) => reminder.status === 'sent').length,
        failed: reminders.filter((reminder) => reminder.status === 'failed').length,
        next: reminders
          .filter((reminder) => reminder.status === 'scheduled' && reminder.scheduledFor)
          .slice(0, 5)
          .map((reminder) => ({
            id: reminder.id,
            status: reminder.status,
            scheduledFor: reminder.scheduledFor?.toISOString() ?? null,
            value: reminder.value,
          })),
      },
      imports: imports.map((job) => ({
        id: job.id,
        moduleKey: job.moduleKey,
        fileName: job.fileName,
        status: job.status,
        totalRows: job.totalRows,
        createdCount: job.createdCount,
        updatedCount: job.updatedCount,
        skippedCount: job.skippedCount,
        errorCount: job.errorCount,
        rollbackToken: job.rollbackToken,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      })),
      activity: activity.map((event) => ({
        id: event.id,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        createdAt: event.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[planner overview GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load the daily planner overview.' },
      { status: 500 },
    )
  }
}
