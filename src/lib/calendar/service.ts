import type { AppSession, DashboardRole } from '@/lib/app-session'
import { db } from '@/lib/db'
import { listAccessibleWeddings } from '@/lib/wedding-access'
import {
  calendarRangeSchema,
  combineWeddingDateAndProgrammeTime,
  isCalendarItemInRange,
  type CalendarCategory,
  type CalendarItem,
  type CalendarRangeInput,
} from '@/lib/calendar/contracts'

interface Principal {
  userId: string
  role: DashboardRole
}

function effectivePrincipal(session: AppSession): Principal | null {
  const userId = session.effectiveUserId ?? session.userId ?? null
  if (!userId) return null
  return { userId, role: session.effectiveRole ?? session.role }
}

function sourceLink(role: DashboardRole, category: CalendarCategory): string | null {
  if (role === 'admin') return '/admin'
  if (role === 'vendor') return '/vendor'

  switch (category) {
    case 'task':
      return '/planner/tasks'
    case 'budget':
    case 'payment':
      return '/planner/budget'
    case 'engagement':
    case 'contract':
      return '/planner/vendors'
    case 'rsvp':
      return '/planner/guests'
    case 'programme':
      return '/planner/timeline'
    case 'wedding':
      return '/planner'
    default:
      return '/planner'
  }
}

function placeholders(count: number, offset = 0) {
  return Array.from({ length: count }, (_, index) => `$${offset + index + 1}`).join(', ')
}

function normalizeAllDay(date: Date) {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

export async function listCalendarItemsForSession(
  session: AppSession,
  input: CalendarRangeInput = {},
): Promise<CalendarItem[]> {
  const principal = effectivePrincipal(session)
  if (!principal) return []

  const range = calendarRangeSchema.parse(input)
  const accessible = (await listAccessibleWeddings(principal.userId, principal.role)).filter(
    (wedding) => wedding.membershipStatus === 'active',
  )
  const scoped = range.weddingId
    ? accessible.filter((wedding) => wedding.id === range.weddingId)
    : accessible

  if (scoped.length === 0) return []

  const weddingIds = scoped.map((wedding) => wedding.id)
  const titleByWedding = new Map(scoped.map((wedding) => [wedding.id, wedding.title]))
  const allowedCategories = range.categories ? new Set(range.categories) : null
  const items: CalendarItem[] = []

  const include = (category: CalendarCategory) => !allowedCategories || allowedCategories.has(category)
  const push = (item: CalendarItem) => {
    if (!include(item.category)) return
    if (!isCalendarItemInRange(item, range.from, range.to)) return
    items.push(item)
  }

  // Admin calendar starts fail-closed. Admin operational adapters are separate from wedding
  // business projections and will be introduced when the source records are explicitly classified.
  if (principal.role === 'admin') return []

  if (principal.role !== 'vendor') {
    if (include('wedding')) {
      for (const wedding of scoped) {
        push({
          id: `wedding:${wedding.id}:date`,
          sourceType: 'wedding',
          sourceId: wedding.id,
          weddingId: wedding.id,
          weddingTitle: wedding.title,
          title: `${wedding.title} — Wedding day`,
          description: wedding.venue || null,
          startAt: normalizeAllDay(wedding.date),
          endAt: null,
          allDay: true,
          category: 'wedding',
          status: null,
          priority: 'important',
          deepLink: sourceLink(principal.role, 'wedding'),
          metadata: null,
        })
      }
    }

    if (include('task')) {
      const rows = await db.$queryRawUnsafe<
        Array<{
          id: string
          weddingId: string
          title: string
          description: string | null
          dueDate: Date
          status: string
          priority: string
          category: string
          assigneeUserId: string | null
        }>
      >(
        `
          SELECT id, "weddingId", title, description, "dueDate", status, priority, category, "assigneeUserId"
          FROM public."PlannerTask"
          WHERE "weddingId" IN (${placeholders(weddingIds.length)})
            AND "dueDate" IS NOT NULL
        `,
        ...weddingIds,
      )

      for (const row of rows) {
        push({
          id: `task:${row.id}:due`,
          sourceType: 'planner_task',
          sourceId: row.id,
          weddingId: row.weddingId,
          weddingTitle: titleByWedding.get(row.weddingId) ?? null,
          title: row.title,
          description: row.description,
          startAt: row.dueDate,
          endAt: null,
          allDay: false,
          category: 'task',
          status: row.status,
          priority: row.priority,
          deepLink: sourceLink(principal.role, 'task'),
          metadata: {
            taskCategory: row.category,
            assigneeUserId: row.assigneeUserId,
          },
        })
      }
    }

    if (include('budget')) {
      const rows = await db.$queryRawUnsafe<
        Array<{
          id: string
          weddingId: string
          description: string
          category: string
          dueDate: Date
          estimatedCost: number
          actualCost: number | null
          paidAmount: number
          currency: string
          vendorName: string | null
        }>
      >(
        `
          SELECT id, "weddingId", description, category, "dueDate", "estimatedCost",
                 "actualCost", "paidAmount", currency, "vendorName"
          FROM public."BudgetItem"
          WHERE "weddingId" IN (${placeholders(weddingIds.length)})
            AND "dueDate" IS NOT NULL
        `,
        ...weddingIds,
      )

      for (const row of rows) {
        const expected = row.actualCost ?? row.estimatedCost
        const outstanding = Math.max(0, Number(expected) - Number(row.paidAmount))
        push({
          id: `budget:${row.id}:due`,
          sourceType: 'budget_item',
          sourceId: row.id,
          weddingId: row.weddingId,
          weddingTitle: titleByWedding.get(row.weddingId) ?? null,
          title: row.vendorName ? `${row.vendorName}: ${row.description}` : row.description,
          description: outstanding > 0
            ? `${row.currency} ${outstanding.toFixed(2)} outstanding`
            : 'Payment recorded',
          startAt: row.dueDate,
          endAt: null,
          allDay: true,
          category: 'budget',
          status: outstanding > 0 ? 'outstanding' : 'paid',
          priority: outstanding > 0 ? 'important' : 'normal',
          deepLink: sourceLink(principal.role, 'budget'),
          metadata: {
            budgetCategory: row.category,
            currency: row.currency,
            outstanding,
          },
        })
      }
    }

    if (include('engagement')) {
      const rows = await db.$queryRawUnsafe<
        Array<{
          id: string
          weddingId: string
          serviceCategory: string
          serviceDescription: string | null
          serviceDate: Date
          serviceLocation: string | null
          lifecycleStatus: string
        }>
      >(
        `
          SELECT id, "weddingId", "serviceCategory", "serviceDescription", "serviceDate",
                 "serviceLocation", "lifecycleStatus"
          FROM public."ServiceEngagement"
          WHERE "weddingId" IN (${placeholders(weddingIds.length)})
            AND "serviceDate" IS NOT NULL
        `,
        ...weddingIds,
      )

      for (const row of rows) {
        push({
          id: `engagement:${row.id}:service`,
          sourceType: 'service_engagement',
          sourceId: row.id,
          weddingId: row.weddingId,
          weddingTitle: titleByWedding.get(row.weddingId) ?? null,
          title: row.serviceDescription || row.serviceCategory,
          description: row.serviceLocation,
          startAt: row.serviceDate,
          endAt: null,
          allDay: false,
          category: 'engagement',
          status: row.lifecycleStatus,
          priority: 'normal',
          deepLink: sourceLink(principal.role, 'engagement'),
          metadata: { serviceCategory: row.serviceCategory },
        })
      }
    }

    if (include('rsvp')) {
      const rows = await db.$queryRawUnsafe<
        Array<{ id: string; title: string; rsvpDeadline: Date }>
      >(
        `
          SELECT id, title, "rsvpDeadline"
          FROM public."Wedding"
          WHERE id IN (${placeholders(weddingIds.length)})
            AND "rsvpDeadline" IS NOT NULL
        `,
        ...weddingIds,
      )

      for (const row of rows) {
        push({
          id: `wedding:${row.id}:rsvp`,
          sourceType: 'wedding',
          sourceId: row.id,
          weddingId: row.id,
          weddingTitle: row.title,
          title: 'RSVP deadline',
          description: `${row.title} guest response deadline`,
          startAt: normalizeAllDay(row.rsvpDeadline),
          endAt: null,
          allDay: true,
          category: 'rsvp',
          status: null,
          priority: 'important',
          deepLink: sourceLink(principal.role, 'rsvp'),
          metadata: null,
        })
      }
    }

    if (include('programme')) {
      const rows = await db.$queryRawUnsafe<
        Array<{
          id: string
          weddingId: string
          time: string
          title: string
          description: string | null
          location: string | null
          duration: string | null
          weddingDate: Date
        }>
      >(
        `
          SELECT p.id, p."weddingId", p.time, p.title, p.description, p.location, p.duration,
                 w.date AS "weddingDate"
          FROM public."ProgrammeItem" p
          JOIN public."Wedding" w ON w.id = p."weddingId"
          WHERE p."weddingId" IN (${placeholders(weddingIds.length)})
        `,
        ...weddingIds,
      )

      for (const row of rows) {
        const normalized = combineWeddingDateAndProgrammeTime(row.weddingDate, row.time)
        push({
          id: `programme:${row.id}`,
          sourceType: 'programme_item',
          sourceId: row.id,
          weddingId: row.weddingId,
          weddingTitle: titleByWedding.get(row.weddingId) ?? null,
          title: row.title,
          description: row.location || row.description,
          startAt: normalized.date,
          endAt: null,
          allDay: normalized.allDay,
          category: 'programme',
          status: null,
          priority: 'normal',
          deepLink: sourceLink(principal.role, 'programme'),
          metadata: { rawTime: row.time, duration: row.duration },
        })
      }
    }
  } else if (include('engagement')) {
    const idsOffset = 1
    const rows = await db.$queryRawUnsafe<
      Array<{
        id: string
        weddingId: string
        serviceCategory: string
        serviceDescription: string | null
        serviceDate: Date
        serviceLocation: string | null
        lifecycleStatus: string
      }>
    >(
      `
        SELECT DISTINCT se.id, se."weddingId", se."serviceCategory", se."serviceDescription",
               se."serviceDate", se."serviceLocation", se."lifecycleStatus"
        FROM public."ServiceEngagement" se
        JOIN public."EngagementParty" ep
          ON ep."serviceEngagementId" = se.id AND ep."weddingId" = se."weddingId"
        WHERE ep."userId" = $1
          AND ep.status = 'active'
          AND se."weddingId" IN (${placeholders(weddingIds.length, idsOffset)})
          AND se."serviceDate" IS NOT NULL
      `,
      principal.userId,
      ...weddingIds,
    )

    for (const row of rows) {
      push({
        id: `engagement:${row.id}:service`,
        sourceType: 'service_engagement',
        sourceId: row.id,
        weddingId: row.weddingId,
        weddingTitle: titleByWedding.get(row.weddingId) ?? null,
        title: row.serviceDescription || row.serviceCategory,
        description: row.serviceLocation,
        startAt: row.serviceDate,
        endAt: null,
        allDay: false,
        category: 'engagement',
        status: row.lifecycleStatus,
        priority: 'important',
        deepLink: sourceLink(principal.role, 'engagement'),
        metadata: { serviceCategory: row.serviceCategory },
      })
    }
  }

  return items
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.title.localeCompare(b.title))
    .slice(0, range.limit)
}
