import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  csvRows,
  parseJsonObject,
  partyHeadcount,
  type EventIssueValue,
  type TimelineStatusValue,
} from '@/lib/planner-phase6'
import { requireWeddingPermission } from '@/lib/wedding-access'

function safeFilePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'wedding'
}

function csvResponse(fileName: string, rows: unknown[][]): NextResponse {
  return new NextResponse(`\uFEFF${csvRows(rows)}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'export.data')
  if (access.error) return access.error

  try {
    const weddingId = access.context.weddingId
    const kind = request.nextUrl.searchParams.get('kind') || 'guest-manifest'
    const wedding = await db.wedding.findUnique({
      where: { id: weddingId },
      select: { title: true, date: true },
    })
    if (!wedding) {
      return NextResponse.json({ success: false, error: 'Active wedding not found.' }, { status: 404 })
    }
    const prefix = safeFilePart(wedding.title)

    if (kind === 'guest-manifest') {
      const guests = await db.guest.findMany({
        where: { weddingId },
        include: {
          rsvp: true,
          seatingTable: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      })
      const rows: unknown[][] = [[
        'Guest name',
        'RSVP status',
        'Party size',
        'Checked in',
        'Checked-in time',
        'Table',
        'Role',
        'Side',
        'Phone',
        'Email',
        'Meal choice',
        'Dietary notes',
        'Plus-one name',
      ]]
      for (const guest of guests) {
        rows.push([
          guest.name,
          guest.rsvp?.attending === true ? 'Attending' : guest.rsvp?.attending === false ? 'Declined' : 'Pending',
          partyHeadcount(guest.rsvp),
          guest.rsvp?.checkedIn ? 'Yes' : 'No',
          guest.rsvp?.checkedInAt?.toISOString() ?? '',
          guest.seatingTable?.name ?? '',
          guest.role,
          guest.side ?? '',
          guest.phone ?? '',
          guest.email ?? '',
          guest.rsvp?.mealChoice ?? '',
          guest.rsvp?.dietaryNotes ?? '',
          guest.rsvp?.plusOneName ?? '',
        ])
      }
      return csvResponse(`${prefix}-guest-manifest.csv`, rows)
    }

    if (kind === 'run-sheet') {
      const [items, revisions] = await Promise.all([
        db.programmeItem.findMany({
          where: { weddingId },
          orderBy: [{ order: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }],
        }),
        db.contentRevision.findMany({
          where: { weddingId, section: 'event_day_timeline_status' },
          orderBy: { updatedAt: 'desc' },
        }),
      ])
      const statuses = new Map<string, TimelineStatusValue>()
      for (const revision of revisions) {
        if (!statuses.has(revision.fieldKey)) {
          statuses.set(
            revision.fieldKey,
            parseJsonObject<TimelineStatusValue>(revision.value, {
              status: 'pending',
              updatedAt: revision.updatedAt.toISOString(),
              updatedBy: revision.authorId,
            }),
          )
        }
      }
      const rows: unknown[][] = [['Time', 'Activity', 'Operational status', 'Notes', 'Last status update']]
      for (const item of items) {
        const status = statuses.get(item.id)
        rows.push([
          item.time,
          item.title,
          status?.status ?? 'pending',
          item.description ?? '',
          status?.updatedAt ?? '',
        ])
      }
      return csvResponse(`${prefix}-run-sheet.csv`, rows)
    }

    if (kind === 'issues') {
      const revisions = await db.contentRevision.findMany({
        where: { weddingId, section: 'event_day_issue' },
        orderBy: { createdAt: 'asc' },
      })
      const rows: unknown[][] = [[
        'Status',
        'Severity',
        'Issue',
        'Owner',
        'Notes',
        'Created',
        'Resolved',
      ]]
      for (const revision of revisions) {
        const issue = parseJsonObject<EventIssueValue>(revision.value, {
          title: revision.fieldKey,
          notes: '',
          severity: 'medium',
          owner: '',
          createdAt: revision.createdAt.toISOString(),
          resolvedAt: null,
          resolvedBy: null,
        })
        rows.push([
          revision.status,
          issue.severity,
          issue.title,
          issue.owner,
          issue.notes,
          issue.createdAt,
          issue.resolvedAt ?? '',
        ])
      }
      return csvResponse(`${prefix}-event-issues.csv`, rows)
    }

    return NextResponse.json(
      { success: false, error: 'Unknown export. Use guest-manifest, run-sheet, or issues.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[EVENT DAY EXPORT] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to export event operations.' }, { status: 500 })
  }
}
