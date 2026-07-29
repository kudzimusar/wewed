import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  checkedInHeadcount,
  eventReadiness,
  normaliseIssueSeverity,
  normaliseTimelineStatus,
  parseJsonObject,
  partyHeadcount,
  type EventIssueValue,
  type TimelineStatusValue,
} from '@/lib/planner-phase6'
import { requireWeddingPermission } from '@/lib/wedding-access'

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const weddingId = access.context.weddingId
    const [wedding, guests, tables, timeline, revisions] = await Promise.all([
      db.wedding.findUnique({
        where: { id: weddingId },
        select: {
          id: true,
          slug: true,
          title: true,
          date: true,
          venue: true,
          venueCity: true,
          venueCountry: true,
        },
      }),
      db.guest.findMany({
        where: { weddingId },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
        orderBy: { name: 'asc' },
      }),
      db.seatingTable.findMany({
        where: { weddingId },
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      }),
      db.programmeItem.findMany({
        where: { weddingId },
        orderBy: [{ order: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }],
      }),
      db.contentRevision.findMany({
        where: {
          weddingId,
          section: { in: ['event_day_issue', 'event_day_timeline_status'] },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    if (!wedding) {
      return NextResponse.json({ success: false, error: 'Active wedding not found.' }, { status: 404 })
    }

    const timelineStatus = new Map<string, TimelineStatusValue>()
    const issues: Array<{
      id: string
      status: string
      title: string
      notes: string
      severity: string
      owner: string
      createdAt: string
      resolvedAt: string | null
      resolvedBy: string | null
    }> = []

    for (const revision of revisions) {
      if (revision.section === 'event_day_timeline_status' && !timelineStatus.has(revision.fieldKey)) {
        timelineStatus.set(
          revision.fieldKey,
          parseJsonObject<TimelineStatusValue>(revision.value, {
            status: 'pending',
            updatedAt: revision.updatedAt.toISOString(),
            updatedBy: revision.authorId,
          }),
        )
      }
      if (revision.section === 'event_day_issue') {
        const issue = parseJsonObject<EventIssueValue>(revision.value, {
          title: revision.fieldKey,
          notes: '',
          severity: 'medium',
          owner: '',
          createdAt: revision.createdAt.toISOString(),
          resolvedAt: null,
          resolvedBy: null,
        })
        issues.push({ id: revision.id, status: revision.status, ...issue })
      }
    }

    const guestRows = guests.map((guest) => {
      const partySize = partyHeadcount(guest.rsvp)
      const checkedHeads = checkedInHeadcount(guest.rsvp)
      return {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        role: guest.role,
        side: guest.side,
        tableId: guest.seatingTableId,
        tableName: guest.seatingTable?.name ?? null,
        attending: guest.rsvp?.attending ?? null,
        mealChoice: guest.rsvp?.mealChoice ?? null,
        dietaryNotes: guest.rsvp?.dietaryNotes ?? null,
        plusOneName: guest.rsvp?.plusOneName ?? null,
        checkedIn: guest.rsvp?.checkedIn ?? false,
        checkedInAt: guest.rsvp?.checkedInAt?.toISOString() ?? null,
        partySize,
        checkedInHeads: checkedHeads,
      }
    })

    const tableRows = tables.map((table) => {
      const assigned = guests.filter((guest) => guest.seatingTableId === table.id)
      const expectedHeads = assigned.reduce((total, guest) => total + partyHeadcount(guest.rsvp), 0)
      const checkedHeads = assigned.reduce((total, guest) => total + checkedInHeadcount(guest.rsvp), 0)
      return {
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        position: table.position,
        expectedHeads,
        checkedInHeads: checkedHeads,
        remaining: Math.max(0, table.capacity - expectedHeads),
        overCapacity: expectedHeads > table.capacity,
      }
    })

    const timelineRows = timeline.map((item) => {
      const state = timelineStatus.get(item.id)
      return {
        id: item.id,
        time: item.time,
        title: item.title,
        description: item.description,
        order: item.order,
        status: state?.status ?? 'pending',
        statusUpdatedAt: state?.updatedAt ?? null,
      }
    })

    const expectedGuests = guestRows.filter((guest) => guest.attending === true)
    const expectedHeads = expectedGuests.reduce((total, guest) => total + guest.partySize, 0)
    const checkedInGuests = guestRows.filter((guest) => guest.checkedIn)
    const checkedInHeads = checkedInGuests.reduce((total, guest) => total + guest.checkedInHeads, 0)
    const unseatedHeads = expectedGuests
      .filter((guest) => !guest.tableId)
      .reduce((total, guest) => total + guest.partySize, 0)
    const openIssues = issues.filter((issue) => issue.status !== 'resolved')
    const openCriticalIssues = openIssues.filter(
      (issue) => issue.severity === 'critical' || issue.severity === 'high',
    ).length
    const incompleteTimelineItems = timelineRows.filter((item) => item.status !== 'complete').length

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      wedding: {
        ...wedding,
        date: wedding.date.toISOString(),
      },
      stats: {
        totalGuests: guestRows.length,
        expectedGuests: expectedGuests.length,
        expectedHeads,
        checkedInGuests: checkedInGuests.length,
        checkedInHeads,
        remainingHeads: Math.max(0, expectedHeads - checkedInHeads),
        unseatedHeads,
        openIssues: openIssues.length,
        openCriticalIssues,
        timelineComplete: timelineRows.filter((item) => item.status === 'complete').length,
        timelineTotal: timelineRows.length,
        readiness: eventReadiness({
          expectedHeads,
          checkedInHeads,
          unseatedHeads,
          openCriticalIssues,
          incompleteTimelineItems,
        }),
      },
      guests: guestRows,
      tables: tableRows,
      timeline: timelineRows,
      issues,
    })
  } catch (error) {
    console.error('[EVENT DAY GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load wedding-day operations.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 60)
    const permission =
      action === 'set_check_in'
        ? 'guests.edit'
        : action === 'set_timeline_status'
          ? 'timeline.edit'
          : 'planner.edit'
    const access = await requireWeddingPermission(request, permission)
    if (access.error) return access.error

    const weddingId = access.context.weddingId
    const actorId = access.context.session.userId

    if (action === 'set_check_in') {
      const guestId = text(body.guestId, 100)
      const checkedIn = body.checkedIn === true
      const guest = await db.guest.findFirst({
        where: { id: guestId, weddingId },
        select: { id: true, name: true },
      })
      if (!guest) {
        return NextResponse.json({ success: false, error: 'Guest not found.' }, { status: 404 })
      }

      const checkedInAt = checkedIn ? new Date() : null
      const rsvp = await db.$transaction(async (tx) => {
        const updated = await tx.rSVP.upsert({
          where: { guestId: guest.id },
          update: { checkedIn, checkedInAt },
          create: {
            guestId: guest.id,
            token: randomUUID(),
            checkedIn,
            checkedInAt,
          },
        })
        await tx.auditEvent.create({
          data: {
            action: checkedIn ? 'event_day.guest_check_in' : 'event_day.guest_check_out',
            resourceType: 'guest',
            resourceId: guest.id,
            afterValue: JSON.stringify({ guestName: guest.name, checkedIn, checkedInAt }),
            weddingId,
            actorId,
          },
        })
        return updated
      })

      return NextResponse.json({
        success: true,
        data: {
          guestId: guest.id,
          checkedIn: rsvp.checkedIn,
          checkedInAt: rsvp.checkedInAt?.toISOString() ?? null,
        },
      })
    }

    if (action === 'set_timeline_status') {
      const itemId = text(body.itemId, 100)
      const status = normaliseTimelineStatus(body.status)
      const item = await db.programmeItem.findFirst({
        where: { id: itemId, weddingId },
        select: { id: true, title: true },
      })
      if (!item) {
        return NextResponse.json({ success: false, error: 'Timeline item not found.' }, { status: 404 })
      }

      const value: TimelineStatusValue = {
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: actorId,
      }
      const existing = await db.contentRevision.findFirst({
        where: { weddingId, section: 'event_day_timeline_status', fieldKey: item.id },
        orderBy: { updatedAt: 'desc' },
      })
      const revision = existing
        ? await db.contentRevision.update({
            where: { id: existing.id },
            data: { value: JSON.stringify(value), status: 'published', authorId: actorId },
          })
        : await db.contentRevision.create({
            data: {
              weddingId,
              section: 'event_day_timeline_status',
              fieldKey: item.id,
              value: JSON.stringify(value),
              status: 'published',
              authorId: actorId,
              publishedAt: new Date(),
            },
          })
      await db.auditEvent.create({
        data: {
          action: 'event_day.timeline_status',
          resourceType: 'programme_item',
          resourceId: item.id,
          afterValue: JSON.stringify({ title: item.title, status }),
          weddingId,
          actorId,
        },
      })
      return NextResponse.json({ success: true, data: { id: revision.id, itemId, status } })
    }

    if (action === 'create_issue') {
      const title = text(body.title, 160)
      if (!title) {
        return NextResponse.json({ success: false, error: 'Issue title is required.' }, { status: 400 })
      }
      const issue: EventIssueValue = {
        title,
        notes: text(body.notes, 3000),
        severity: normaliseIssueSeverity(body.severity),
        owner: text(body.owner, 160),
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolvedBy: null,
      }
      const revision = await db.contentRevision.create({
        data: {
          weddingId,
          section: 'event_day_issue',
          fieldKey: randomUUID(),
          value: JSON.stringify(issue),
          status: 'active',
          authorId: actorId,
        },
      })
      await db.auditEvent.create({
        data: {
          action: 'event_day.issue_create',
          resourceType: 'event_day_issue',
          resourceId: revision.id,
          afterValue: JSON.stringify(issue),
          weddingId,
          actorId,
        },
      })
      return NextResponse.json({ success: true, data: { id: revision.id, status: revision.status, ...issue } })
    }

    if (action === 'resolve_issue' || action === 'reopen_issue') {
      const issueId = text(body.issueId, 100)
      const revision = await db.contentRevision.findFirst({
        where: { id: issueId, weddingId, section: 'event_day_issue' },
      })
      if (!revision) {
        return NextResponse.json({ success: false, error: 'Issue not found.' }, { status: 404 })
      }
      const current = parseJsonObject<EventIssueValue>(revision.value, {
        title: revision.fieldKey,
        notes: '',
        severity: 'medium',
        owner: '',
        createdAt: revision.createdAt.toISOString(),
        resolvedAt: null,
        resolvedBy: null,
      })
      const resolved = action === 'resolve_issue'
      const value: EventIssueValue = {
        ...current,
        resolvedAt: resolved ? new Date().toISOString() : null,
        resolvedBy: resolved ? actorId : null,
      }
      const updated = await db.contentRevision.update({
        where: { id: revision.id },
        data: {
          status: resolved ? 'resolved' : 'active',
          value: JSON.stringify(value),
          authorId: actorId,
        },
      })
      await db.auditEvent.create({
        data: {
          action: resolved ? 'event_day.issue_resolve' : 'event_day.issue_reopen',
          resourceType: 'event_day_issue',
          resourceId: updated.id,
          afterValue: JSON.stringify(value),
          weddingId,
          actorId,
        },
      })
      return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status, ...value } })
    }

    return NextResponse.json({ success: false, error: 'Unsupported event-day action.' }, { status: 400 })
  } catch (error) {
    console.error('[EVENT DAY POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to update wedding-day operations.' },
      { status: 500 },
    )
  }
}
