import { db } from '@/lib/db'
import { describeTaskDueState } from '@/lib/ai/task-due-state'

export const PUBLIC_AI_CONTENT_SECTIONS = new Set([
  'faq',
  'hero',
  'songbook',
  'story',
  'theday',
  'travel',
  'venue',
])

export const GUEST_ACCESSIBLE_PRIVACY = ['public', 'unlisted', 'link_only'] as const

const MAX_CONTEXT_CHARACTERS = 32_000
const MAX_DOCUMENT_RESULTS = 6

export type AiContextPermission =
  | 'planner.view'
  | 'guests.view'
  | 'budget.view'
  | 'vendors.view'
  | 'timeline.view'

export interface RetrievedAiSource {
  id: string
  documentId: string
  title: string
  excerpt: string
  sourceUrl: string | null
  visibility: 'private' | 'public'
  score: number
}

interface DocumentChunkValue {
  documentId: string
  title: string
  text: string
  sourceUrl?: string | null
  visibility?: 'private' | 'public'
  chunkIndex: number
  checksum?: string
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function cleanLine(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function bounded(lines: string[], maxCharacters = MAX_CONTEXT_CHARACTERS): string {
  let output = ''
  for (const line of lines) {
    const next = output ? `${output}\n${line}` : line
    if (next.length > maxCharacters) break
    output = next
  }
  return output
}

export async function buildPublishedWeddingContext(slug: string): Promise<string | null> {
  const wedding = await db.wedding.findFirst({
    where: {
      slug,
      privacy: { in: [...GUEST_ACCESSIBLE_PRIVACY] },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      date: true,
      venue: true,
      venueCity: true,
      venueCountry: true,
      venueMapUrl: true,
      invitationCardMessage: true,
      rsvpDeadline: true,
      programmeItems: {
        orderBy: [{ order: 'asc' }, { time: 'asc' }],
        select: {
          time: true,
          title: true,
          description: true,
          duration: true,
          location: true,
        },
      },
      contentItems: {
        orderBy: [{ section: 'asc' }, { order: 'asc' }, { field: 'asc' }],
        select: { section: true, field: true, value: true, metadata: true },
      },
    },
  })

  if (!wedding) return null

  const lines = [
    'PUBLISHED WEDDING CONTEXT',
    `Wedding: ${cleanLine(wedding.title)}`,
    `Date: ${wedding.date.toISOString()}`,
    `Venue: ${cleanLine(wedding.venue)}, ${cleanLine(wedding.venueCity)}, ${cleanLine(wedding.venueCountry)}`,
    wedding.tagline ? `Tagline: ${cleanLine(wedding.tagline)}` : '',
    wedding.venueMapUrl ? `Venue map: ${cleanLine(wedding.venueMapUrl)}` : '',
    wedding.invitationCardMessage
      ? `Invitation message: ${cleanLine(wedding.invitationCardMessage)}`
      : '',
    wedding.rsvpDeadline
      ? `RSVP deadline: ${wedding.rsvpDeadline.toISOString()}`
      : '',
    '',
    'PUBLISHED PROGRAMME',
    ...wedding.programmeItems.map((item) =>
      [item.time, item.title, item.location, item.duration, item.description]
        .map(cleanLine)
        .filter(Boolean)
        .join(' — '),
    ),
    '',
    'PUBLISHED PAGE CONTENT',
    ...wedding.contentItems
      .filter((item) => PUBLIC_AI_CONTENT_SECTIONS.has(item.section))
      .map((item) => {
        const metadata = safeJson<Record<string, unknown>>(item.metadata ?? '', {})
        const published = metadata.visibility !== 'private' && metadata.published !== false
        return published
          ? `${cleanLine(item.section)}.${cleanLine(item.field)}: ${cleanLine(item.value)}`
          : ''
      })
      .filter(Boolean),
  ].filter(Boolean)

  return bounded(lines, 24_000)
}

export async function buildPlannerWeddingContext(
  weddingId: string,
  permissions: string[],
): Promise<string> {
  const has = (permission: AiContextPermission) =>
    permissions.includes('*') || permissions.includes(permission)
  const contextGeneratedAt = new Date()

  const [wedding, tasks, guests, budgets, vendors, timeline] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      select: {
        title: true,
        date: true,
        venue: true,
        venueCity: true,
        venueCountry: true,
        lifecycle: true,
        privacy: true,
        rsvpDeadline: true,
      },
    }),
    has('planner.view')
      ? db.plannerTask.findMany({
          where: { weddingId },
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
          take: 160,
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            status: true,
            priority: true,
            dueDate: true,
            assignee: true,
          },
        })
      : Promise.resolve([]),
    has('guests.view')
      ? db.guest.findMany({
          where: { weddingId },
          orderBy: { name: 'asc' },
          take: 220,
          select: {
            id: true,
            name: true,
            role: true,
            side: true,
            rsvp: {
              select: {
                attending: true,
                mealChoice: true,
                plusOne: true,
                kidsAttending: true,
                kidsCount: true,
                dietaryNotes: true,
                checkedIn: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    has('budget.view')
      ? db.budgetItem.findMany({
          where: { weddingId },
          orderBy: [{ dueDate: 'asc' }, { estimatedCost: 'desc' }],
          take: 120,
          select: {
            category: true,
            description: true,
            estimatedCost: true,
            actualCost: true,
            paidAmount: true,
            currency: true,
            dueDate: true,
            vendorName: true,
          },
        })
      : Promise.resolve([]),
    has('vendors.view')
      ? db.vendor.findMany({
          where: { weddingId },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
          take: 100,
          select: {
            name: true,
            category: true,
            contractStatus: true,
            paymentStatus: true,
            planningRating: true,
            notes: true,
          },
        })
      : Promise.resolve([]),
    has('timeline.view')
      ? db.programmeItem.findMany({
          where: { weddingId },
          orderBy: [{ order: 'asc' }, { time: 'asc' }],
          take: 160,
          select: {
            time: true,
            title: true,
            description: true,
            duration: true,
            location: true,
          },
        })
      : Promise.resolve([]),
  ])

  if (!wedding) return 'No active wedding context is available.'

  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
  tasks.sort((left, right) => {
    const byPriority = (priorityRank[left.priority] ?? 3) - (priorityRank[right.priority] ?? 3)
    if (byPriority !== 0) return byPriority
    const leftDue = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
    const rightDue = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
    return leftDue - rightDue
  })

  const attendance = guests.reduce(
    (counts, guest) => {
      if (guest.rsvp?.attending === true) counts.attending += 1
      else if (guest.rsvp?.attending === false) counts.declined += 1
      else counts.pending += 1
      return counts
    },
    { attending: 0, declined: 0, pending: 0 },
  )

  const budgetSummary = budgets.reduce(
    (totals, item) => {
      totals.estimated += item.estimatedCost
      totals.actual += item.actualCost ?? 0
      totals.paid += item.paidAmount
      return totals
    },
    { estimated: 0, actual: 0, paid: 0 },
  )

  const lines = [
    'AUTHORISED PLANNER CONTEXT',
    `Context generated at (UTC): ${contextGeneratedAt.toISOString()}`,
    `Wedding: ${cleanLine(wedding.title)}`,
    `Date: ${wedding.date.toISOString()}`,
    `Venue: ${cleanLine(wedding.venue)}, ${cleanLine(wedding.venueCity)}, ${cleanLine(wedding.venueCountry)}`,
    `Lifecycle: ${cleanLine(wedding.lifecycle)}`,
    `Privacy: ${cleanLine(wedding.privacy)}`,
    wedding.rsvpDeadline ? `RSVP deadline: ${wedding.rsvpDeadline.toISOString()}` : '',
    '',
    `TASKS (${tasks.length})`,
    ...tasks.map((task) =>
      [
        task.id,
        task.priority || 'medium',
        task.status,
        task.category,
        task.title,
        task.dueDate?.toISOString() ?? 'no due date',
        `due_state ${describeTaskDueState(task.dueDate, task.status, contextGeneratedAt)}`,
        task.assignee ?? 'unassigned',
        task.description ?? '',
      ]
        .map(cleanLine)
        .join(' | '),
    ),
    '',
    `RSVP SUMMARY: attending=${attendance.attending}, declined=${attendance.declined}, pending=${attendance.pending}`,
    ...guests.map((guest) =>
      [
        guest.id,
        guest.name,
        guest.role,
        guest.side ?? '',
        guest.rsvp?.attending === true
          ? 'attending'
          : guest.rsvp?.attending === false
            ? 'declined'
            : 'pending',
        guest.rsvp?.mealChoice ?? 'no meal choice',
        guest.rsvp?.plusOne ? 'plus one' : '',
        guest.rsvp?.kidsAttending ? `${guest.rsvp.kidsCount} children` : '',
        guest.rsvp?.dietaryNotes ?? '',
        guest.rsvp?.checkedIn ? 'checked in' : '',
      ]
        .map(cleanLine)
        .filter(Boolean)
        .join(' | '),
    ),
    '',
    `BUDGET SUMMARY: estimated=${budgetSummary.estimated.toFixed(2)}, actual=${budgetSummary.actual.toFixed(2)}, paid=${budgetSummary.paid.toFixed(2)}`,
    ...budgets.map((item) =>
      [
        item.category,
        item.description,
        `estimated ${item.estimatedCost} ${item.currency}`,
        item.actualCost == null ? '' : `actual ${item.actualCost} ${item.currency}`,
        `paid ${item.paidAmount} ${item.currency}`,
        item.dueDate?.toISOString() ?? '',
        item.vendorName ?? '',
      ]
        .map(cleanLine)
        .filter(Boolean)
        .join(' | '),
    ),
    '',
    `VENDORS (${vendors.length})`,
    ...vendors.map((vendor) =>
      [
        vendor.category,
        vendor.name,
        vendor.contractStatus,
        vendor.paymentStatus,
        vendor.planningRating == null ? '' : `rating ${vendor.planningRating}`,
        vendor.notes ?? '',
      ]
        .map(cleanLine)
        .filter(Boolean)
        .join(' | '),
    ),
    '',
    `TIMELINE (${timeline.length})`,
    ...timeline.map((item) =>
      [item.time, item.title, item.location ?? '', item.duration ?? '', item.description ?? '']
        .map(cleanLine)
        .filter(Boolean)
        .join(' | '),
    ),
  ].filter(Boolean)

  return bounded(lines)
}

export async function searchAiDocuments(input: {
  weddingId: string
  query: string
  includePrivate: boolean
  limit?: number
}): Promise<RetrievedAiSource[]> {
  const query = cleanLine(input.query).slice(0, 500)
  if (!query) return []

  const limit = Math.max(1, Math.min(input.limit ?? MAX_DOCUMENT_RESULTS, 10))
  const visibilityClause = input.includePrivate
    ? ''
    : `AND COALESCE((c.value::jsonb ->> 'visibility'), 'private') = 'public'`

  const rows = await db.$queryRawUnsafe<
    Array<{
      id: string
      value: string
      score: number
    }>
  >(
    `
      SELECT c.id,
             c.value,
             ts_rank_cd(
               to_tsvector('simple', COALESCE(c.value, '')),
               websearch_to_tsquery('simple', $2)
             ) AS score
      FROM public."WeddingContent" c
      WHERE c."weddingId" = $1
        AND c.section = 'ai_document_chunk'
        ${visibilityClause}
        AND to_tsvector('simple', COALESCE(c.value, ''))
            @@ websearch_to_tsquery('simple', $2)
      ORDER BY score DESC, c."updatedAt" DESC
      LIMIT $3
    `,
    input.weddingId,
    query,
    limit,
  )

  return rows.flatMap((row) => {
    const value = safeJson<DocumentChunkValue | null>(row.value, null)
    if (!value?.documentId || !value.text || !value.title) return []
    return [
      {
        id: row.id,
        documentId: value.documentId,
        title: cleanLine(value.title),
        excerpt: cleanLine(value.text).slice(0, 900),
        sourceUrl: value.sourceUrl ? cleanLine(value.sourceUrl) : null,
        visibility: value.visibility === 'public' ? 'public' : 'private',
        score: Number(row.score) || 0,
      } satisfies RetrievedAiSource,
    ]
  })
}

export function formatRetrievedSources(sources: RetrievedAiSource[]): string {
  if (sources.length === 0) return ''
  return bounded(
    [
      'RETRIEVED WORKSPACE SOURCES',
      ...sources.map(
        (source, index) =>
          `[S${index + 1}] ${source.title} (${source.visibility})\n${source.excerpt}${source.sourceUrl ? `\nURL: ${source.sourceUrl}` : ''}`,
      ),
      'When using a source, cite it inline as [S1], [S2], and so on. Do not cite sources you did not use.',
    ],
    8_000,
  )
}
