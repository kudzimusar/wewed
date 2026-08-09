import { db } from '@/lib/db'

export type WeddingHealthState = 'on_track' | 'attention' | 'at_risk'
export type AttentionSeverity = 'normal' | 'high' | 'critical'
export type AttentionModule = 'overview' | 'tasks' | 'budget' | 'vendors' | 'guests' | 'timeline'

export interface WeddingHealthInput {
  weddingDate: Date | string
  overdueTasks: number
  blockedTasks: number
  pendingRsvps: number
  pendingVendorContracts: number
  overdueBudgetPayments: number
  timelineItems: number
}

export interface WeddingHealthResult {
  state: WeddingHealthState
  daysUntilWedding: number
  reasons: string[]
}

export interface WeddingAttentionItem {
  module: AttentionModule
  severity: AttentionSeverity
  message: string
}

export interface WeddingIntelligence {
  weddingId: string
  slug: string
  title: string
  date: Date
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
  coupleName: string
  tasks: {
    total: number
    done: number
    overdue: number
    blocked: number
  }
  budget: {
    estimated: number
    actual: number
    paid: number
    outstanding: number
    overduePayments: number
    currency: string
  }
  guests: {
    total: number
    confirmed: number
    declined: number
    pending: number
  }
  vendors: {
    total: number
    signed: number
    pendingContracts: number
    paymentAttention: number
  }
  timeline: {
    items: number
  }
  health: WeddingHealthResult
  attention: WeddingAttentionItem[]
}

type WeddingIntelligenceRow = {
  weddingId: string
  slug: string
  title: string
  date: Date
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
  partner1: string
  partner2: string
  surname: string | null
  taskTotal: number
  taskDone: number
  taskOverdue: number
  taskBlocked: number
  budgetEstimated: number
  budgetActual: number
  budgetPaid: number
  budgetOutstanding: number
  overdueBudgetPayments: number
  budgetCurrency: string | null
  guestTotal: number
  guestConfirmed: number
  guestDeclined: number
  guestPending: number
  vendorTotal: number
  vendorSigned: number
  pendingVendorContracts: number
  vendorPaymentAttention: number
  timelineItems: number
}

function utcDay(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function daysUntilWedding(weddingDate: Date | string, now = new Date()): number {
  return Math.ceil((utcDay(weddingDate) - utcDay(now)) / 86_400_000)
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`
}

export function deriveWeddingHealth(
  input: WeddingHealthInput,
  now = new Date(),
): WeddingHealthResult {
  const days = daysUntilWedding(input.weddingDate, now)
  const isUpcoming = days >= 0
  const reasons: string[] = []
  let state: WeddingHealthState = 'on_track'

  const criticalReasons: string[] = []
  if (isUpcoming && days <= 30 && input.overdueTasks > 0) {
    criticalReasons.push(`${plural(input.overdueTasks, 'overdue task')} with ${days} days to go`)
  }
  if (isUpcoming && days <= 30 && input.pendingVendorContracts > 0) {
    criticalReasons.push(`${plural(input.pendingVendorContracts, 'vendor contract')} still pending`)
  }
  if (isUpcoming && days <= 14 && input.pendingRsvps > 0) {
    criticalReasons.push(`${plural(input.pendingRsvps, 'RSVP')} still pending`)
  }
  if (isUpcoming && days <= 30 && input.blockedTasks >= 2) {
    criticalReasons.push(`${plural(input.blockedTasks, 'blocked task')} close to the wedding`)
  }
  if (isUpcoming && days <= 30 && input.overdueBudgetPayments > 0) {
    criticalReasons.push(`${plural(input.overdueBudgetPayments, 'overdue payment')} close to the wedding`)
  }
  if (isUpcoming && days <= 14 && input.timelineItems === 0) {
    criticalReasons.push('Wedding-day timeline has not been started')
  }

  if (criticalReasons.length > 0) {
    state = 'at_risk'
    reasons.push(...criticalReasons)
  } else {
    const attentionReasons: string[] = []
    if (input.overdueTasks > 0) attentionReasons.push(plural(input.overdueTasks, 'overdue task'))
    if (input.blockedTasks > 0) attentionReasons.push(plural(input.blockedTasks, 'blocked task'))
    if (input.pendingVendorContracts > 0) {
      attentionReasons.push(`${plural(input.pendingVendorContracts, 'vendor contract')} pending`)
    }
    if (isUpcoming && days <= 60 && input.pendingRsvps > 0) {
      attentionReasons.push(`${plural(input.pendingRsvps, 'RSVP')} pending`)
    }
    if (input.overdueBudgetPayments > 0) {
      attentionReasons.push(plural(input.overdueBudgetPayments, 'overdue payment'))
    }

    if (attentionReasons.length > 0) {
      state = 'attention'
      reasons.push(...attentionReasons)
    }
  }

  return { state, daysUntilWedding: days, reasons }
}

export function buildWeddingAttentionItems(input: {
  health: WeddingHealthResult
  tasks: { overdue: number; blocked: number }
  budget: { overduePayments: number }
  guests: { pending: number }
  vendors: { pendingContracts: number }
  timeline: { items: number }
}): WeddingAttentionItem[] {
  const days = input.health.daysUntilWedding
  const upcoming = days >= 0
  const items: WeddingAttentionItem[] = []

  if (input.tasks.overdue > 0) {
    items.push({
      module: 'tasks',
      severity: upcoming && days <= 30 ? 'critical' : 'high',
      message: plural(input.tasks.overdue, 'overdue task'),
    })
  }
  if (input.tasks.blocked > 0) {
    items.push({
      module: 'tasks',
      severity: upcoming && days <= 30 && input.tasks.blocked >= 2 ? 'critical' : 'high',
      message: plural(input.tasks.blocked, 'blocked task'),
    })
  }
  if (input.vendors.pendingContracts > 0) {
    items.push({
      module: 'vendors',
      severity: upcoming && days <= 30 ? 'critical' : 'normal',
      message: `${plural(input.vendors.pendingContracts, 'vendor contract')} pending`,
    })
  }
  if (upcoming && days <= 60 && input.guests.pending > 0) {
    items.push({
      module: 'guests',
      severity: days <= 14 ? 'critical' : 'normal',
      message: `${plural(input.guests.pending, 'RSVP')} pending`,
    })
  }
  if (input.budget.overduePayments > 0) {
    items.push({
      module: 'budget',
      severity: upcoming && days <= 30 ? 'critical' : 'high',
      message: plural(input.budget.overduePayments, 'overdue payment'),
    })
  }
  if (upcoming && days <= 14 && input.timeline.items === 0) {
    items.push({
      module: 'timeline',
      severity: 'critical',
      message: 'Wedding-day timeline has not been started',
    })
  }

  return items
}

function coupleName(row: Pick<WeddingIntelligenceRow, 'partner1' | 'partner2'>): string {
  return [row.partner1, row.partner2].filter(Boolean).join(' & ') || 'Couple'
}

export async function readWeddingIntelligence(
  weddingIds: string[],
  now = new Date(),
): Promise<WeddingIntelligence[]> {
  const ids = Array.from(new Set(weddingIds.filter(Boolean)))
  if (ids.length === 0) return []

  const rows = await db.$queryRawUnsafe<WeddingIntelligenceRow[]>(
    `SELECT
       w.id AS "weddingId",
       w.slug,
       w.title,
       w.date,
       w.venue,
       w."venueCity",
       w."venueCountry",
       w."coupleId",
       c.partner1,
       c.partner2,
       c.surname,
       (SELECT COUNT(*)::int FROM public."PlannerTask" task
         WHERE task."weddingId"=w.id) AS "taskTotal",
       (SELECT COUNT(*)::int FROM public."PlannerTask" task
         WHERE task."weddingId"=w.id AND task.status='done') AS "taskDone",
       (SELECT COUNT(*)::int FROM public."PlannerTask" task
         WHERE task."weddingId"=w.id
           AND task.status <> 'done'
           AND task."dueDate" IS NOT NULL
           AND task."dueDate" < CURRENT_DATE) AS "taskOverdue",
       (SELECT COUNT(*)::int FROM public."PlannerTask" task
         WHERE task."weddingId"=w.id AND task.status='blocked') AS "taskBlocked",
       COALESCE((SELECT SUM(item."estimatedCost") FROM public."BudgetItem" item
         WHERE item."weddingId"=w.id),0)::float8 AS "budgetEstimated",
       COALESCE((SELECT SUM(COALESCE(item."actualCost", item."estimatedCost")) FROM public."BudgetItem" item
         WHERE item."weddingId"=w.id),0)::float8 AS "budgetActual",
       COALESCE((SELECT SUM(item."paidAmount") FROM public."BudgetItem" item
         WHERE item."weddingId"=w.id),0)::float8 AS "budgetPaid",
       COALESCE((SELECT SUM(GREATEST(COALESCE(item."actualCost", item."estimatedCost") - item."paidAmount", 0))
         FROM public."BudgetItem" item WHERE item."weddingId"=w.id),0)::float8 AS "budgetOutstanding",
       (SELECT COUNT(*)::int FROM public."BudgetItem" item
         WHERE item."weddingId"=w.id
           AND item."dueDate" IS NOT NULL
           AND item."dueDate" < CURRENT_DATE
           AND item."paidAmount" < COALESCE(item."actualCost", item."estimatedCost")) AS "overdueBudgetPayments",
       (SELECT item.currency FROM public."BudgetItem" item
         WHERE item."weddingId"=w.id ORDER BY item."createdAt" ASC LIMIT 1) AS "budgetCurrency",
       (SELECT COUNT(*)::int FROM public."Guest" guest
         WHERE guest."weddingId"=w.id) AS "guestTotal",
       (SELECT COUNT(*)::int FROM public."Guest" guest
         JOIN public."RSVP" rsvp ON rsvp."guestId"=guest.id
         WHERE guest."weddingId"=w.id AND rsvp.attending=true) AS "guestConfirmed",
       (SELECT COUNT(*)::int FROM public."Guest" guest
         JOIN public."RSVP" rsvp ON rsvp."guestId"=guest.id
         WHERE guest."weddingId"=w.id AND rsvp.attending=false) AS "guestDeclined",
       (SELECT COUNT(*)::int FROM public."Guest" guest
         LEFT JOIN public."RSVP" rsvp ON rsvp."guestId"=guest.id
         WHERE guest."weddingId"=w.id AND (rsvp.id IS NULL OR rsvp.attending IS NULL)) AS "guestPending",
       (SELECT COUNT(*)::int FROM public."Vendor" vendor
         WHERE vendor."weddingId"=w.id) AS "vendorTotal",
       (SELECT COUNT(*)::int FROM public."Vendor" vendor
         WHERE vendor."weddingId"=w.id AND lower(COALESCE(vendor."contractStatus",''))='signed') AS "vendorSigned",
       (SELECT COUNT(*)::int FROM public."Vendor" vendor
         WHERE vendor."weddingId"=w.id AND lower(COALESCE(vendor."contractStatus",'')) <> 'signed') AS "pendingVendorContracts",
       (SELECT COUNT(*)::int FROM public."Vendor" vendor
         WHERE vendor."weddingId"=w.id
           AND lower(COALESCE(vendor."paymentStatus",'')) NOT IN ('paid','settled','complete','completed')) AS "vendorPaymentAttention",
       (SELECT COUNT(*)::int FROM public."ProgrammeItem" item
         WHERE item."weddingId"=w.id) AS "timelineItems"
     FROM public."Wedding" w
     JOIN public."Couple" c ON c.id=w."coupleId"
     WHERE w.id = ANY($1::text[])
     ORDER BY w.date ASC, w."createdAt" ASC`,
    ids,
  )

  return rows.map((row) => {
    const tasks = {
      total: row.taskTotal,
      done: row.taskDone,
      overdue: row.taskOverdue,
      blocked: row.taskBlocked,
    }
    const budget = {
      estimated: row.budgetEstimated,
      actual: row.budgetActual,
      paid: row.budgetPaid,
      outstanding: row.budgetOutstanding,
      overduePayments: row.overdueBudgetPayments,
      currency: row.budgetCurrency || 'USD',
    }
    const guests = {
      total: row.guestTotal,
      confirmed: row.guestConfirmed,
      declined: row.guestDeclined,
      pending: row.guestPending,
    }
    const vendors = {
      total: row.vendorTotal,
      signed: row.vendorSigned,
      pendingContracts: row.pendingVendorContracts,
      paymentAttention: row.vendorPaymentAttention,
    }
    const timeline = { items: row.timelineItems }
    const health = deriveWeddingHealth(
      {
        weddingDate: row.date,
        overdueTasks: tasks.overdue,
        blockedTasks: tasks.blocked,
        pendingRsvps: guests.pending,
        pendingVendorContracts: vendors.pendingContracts,
        overdueBudgetPayments: budget.overduePayments,
        timelineItems: timeline.items,
      },
      now,
    )

    return {
      weddingId: row.weddingId,
      slug: row.slug,
      title: row.title,
      date: row.date,
      venue: row.venue,
      venueCity: row.venueCity,
      venueCountry: row.venueCountry,
      coupleId: row.coupleId,
      coupleName: coupleName(row),
      tasks,
      budget,
      guests,
      vendors,
      timeline,
      health,
      attention: buildWeddingAttentionItems({ health, tasks, budget, guests, vendors, timeline }),
    }
  })
}
