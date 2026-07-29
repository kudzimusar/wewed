export type IntelligenceSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface PlannerIntelligenceInput {
  wedding: {
    title: string
    date: Date
    lifecycle: string
    privacy: string
    canonSealed: boolean
  }
  tasks: {
    open: number
    overdue: number
    dueSoon: number
  }
  guests: {
    pending: number
    confirmedUnseated: number
    withoutEmail: number
  }
  budget: {
    outstanding: number
    overduePayments: number
    currency: string
  }
  vendors: {
    unsigned: number
    unpaid: number
    missingContact: number
  }
  timeline: {
    total: number
    incomplete: number
  }
  event: {
    openIssues: number
    criticalIssues: number
  }
  reminders: {
    failed: number
  }
  imports: {
    failed: number
  }
  submissions: {
    pending: number
  }
  profile: {
    missing: string[]
  }
  release: {
    activeOwners: number
    overCapacityTables: number
  }
}

export interface IntelligenceRecommendation {
  id: string
  title: string
  reason: string
  evidence: string
  severity: IntelligenceSeverity
  module: string
  task: {
    title: string
    category: string
    priority: 'high' | 'medium' | 'low'
  } | null
}

export interface ReadinessCheck {
  id: string
  label: string
  detail: string
  complete: boolean
  blocking: boolean
  count?: number
}

export interface CloseoutEvaluation {
  datePassed: boolean
  ready: boolean
  checks: ReadinessCheck[]
  completed: number
  total: number
}

export interface ReleaseEvaluation {
  ready: boolean
  checks: ReadinessCheck[]
  completed: number
  total: number
}

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${currency} ${Math.round(value).toLocaleString('en-US')}`
  }
}

function recommendation(
  id: string,
  title: string,
  reason: string,
  evidence: string,
  severity: IntelligenceSeverity,
  module: string,
  task: IntelligenceRecommendation['task'],
): IntelligenceRecommendation {
  return { id, title, reason, evidence, severity, module, task }
}

export function buildPlannerRecommendations(
  input: PlannerIntelligenceInput,
): IntelligenceRecommendation[] {
  const recommendations: IntelligenceRecommendation[] = []

  if (input.event.criticalIssues > 0) {
    recommendations.push(
      recommendation(
        'event-critical-issues',
        'Resolve critical wedding-day issues',
        'Critical or high-severity issues can block safe event execution and closeout.',
        `${input.event.criticalIssues} critical/high issue${input.event.criticalIssues === 1 ? '' : 's'} remain open.`,
        'critical',
        'Wedding Day',
        {
          title: `Resolve ${input.event.criticalIssues} critical wedding-day issue${input.event.criticalIssues === 1 ? '' : 's'}`,
          category: 'wedding_day',
          priority: 'high',
        },
      ),
    )
  }

  if (input.tasks.overdue > 0) {
    recommendations.push(
      recommendation(
        'tasks-overdue',
        'Recover overdue planning work',
        'Overdue work is the clearest signal that the active plan is drifting.',
        `${input.tasks.overdue} open task${input.tasks.overdue === 1 ? ' is' : 's are'} overdue.`,
        input.tasks.overdue >= 5 ? 'critical' : 'high',
        'Tasks',
        {
          title: `Recover ${input.tasks.overdue} overdue planning task${input.tasks.overdue === 1 ? '' : 's'}`,
          category: 'coordination',
          priority: 'high',
        },
      ),
    )
  }

  if (input.budget.overduePayments > 0 || input.budget.outstanding > 0) {
    recommendations.push(
      recommendation(
        'budget-outstanding',
        'Reconcile outstanding wedding costs',
        'Unresolved balances create supplier and closeout risk.',
        `${money(input.budget.outstanding, input.budget.currency)} outstanding · ${input.budget.overduePayments} overdue payment${input.budget.overduePayments === 1 ? '' : 's'}.`,
        input.budget.overduePayments > 0 ? 'high' : 'medium',
        'Budget',
        {
          title: 'Reconcile outstanding wedding costs and payments',
          category: 'budget',
          priority: input.budget.overduePayments > 0 ? 'high' : 'medium',
        },
      ),
    )
  }

  const vendorObligations = input.vendors.unsigned + input.vendors.unpaid
  if (vendorObligations > 0) {
    recommendations.push(
      recommendation(
        'vendors-obligations',
        'Close vendor contract and payment obligations',
        'Unsigned contracts and unpaid vendors remain operational or post-event liabilities.',
        `${input.vendors.unsigned} unsigned · ${input.vendors.unpaid} unpaid.`,
        'high',
        'Vendors',
        {
          title: 'Close outstanding vendor contracts and payments',
          category: 'vendors',
          priority: 'high',
        },
      ),
    )
  }

  if (input.guests.confirmedUnseated > 0) {
    recommendations.push(
      recommendation(
        'guests-unseated',
        'Seat every confirmed guest party',
        'Confirmed parties without tables create immediate guest-experience risk.',
        `${input.guests.confirmedUnseated} confirmed guest record${input.guests.confirmedUnseated === 1 ? '' : 's'} are unseated.`,
        'high',
        'Seating',
        {
          title: `Seat ${input.guests.confirmedUnseated} confirmed guest${input.guests.confirmedUnseated === 1 ? '' : 's'}`,
          category: 'seating',
          priority: 'high',
        },
      ),
    )
  }

  if (input.guests.pending > 0) {
    recommendations.push(
      recommendation(
        'guests-pending-rsvp',
        'Follow up pending RSVPs',
        'Pending attendance affects catering, seating, transport, and budget decisions.',
        `${input.guests.pending} guest${input.guests.pending === 1 ? '' : 's'} have no final RSVP.`,
        'medium',
        'Guests',
        {
          title: `Follow up ${input.guests.pending} pending RSVP${input.guests.pending === 1 ? '' : 's'}`,
          category: 'guests',
          priority: 'medium',
        },
      ),
    )
  }

  if (input.timeline.total > 0 && input.timeline.incomplete > 0) {
    recommendations.push(
      recommendation(
        'timeline-incomplete',
        'Complete the operational run sheet',
        'Incomplete run-sheet items weaken handoffs and post-event reporting.',
        `${input.timeline.incomplete} of ${input.timeline.total} timeline item${input.timeline.total === 1 ? '' : 's'} are not complete.`,
        input.wedding.date.getTime() <= Date.now() ? 'high' : 'medium',
        'Timeline',
        {
          title: 'Complete and verify the wedding-day run sheet',
          category: 'timeline',
          priority: 'high',
        },
      ),
    )
  }

  if (input.reminders.failed > 0) {
    recommendations.push(
      recommendation(
        'reminders-failed',
        'Repair failed RSVP communications',
        'Failed reminders mean invited guests may not have received required information.',
        `${input.reminders.failed} reminder${input.reminders.failed === 1 ? '' : 's'} failed.`,
        'high',
        'Daily Ops',
        {
          title: `Repair ${input.reminders.failed} failed RSVP reminder${input.reminders.failed === 1 ? '' : 's'}`,
          category: 'communications',
          priority: 'high',
        },
      ),
    )
  }

  if (input.imports.failed > 0) {
    recommendations.push(
      recommendation(
        'imports-failed',
        'Review failed data imports',
        'Failed or rollback-failed imports can leave the operational dataset incomplete.',
        `${input.imports.failed} import job${input.imports.failed === 1 ? '' : 's'} require review.`,
        'high',
        'Worksheet recovery',
        {
          title: `Review ${input.imports.failed} failed planner import${input.imports.failed === 1 ? '' : 's'}`,
          category: 'coordination',
          priority: 'high',
        },
      ),
    )
  }

  if (input.profile.missing.length > 0) {
    recommendations.push(
      recommendation(
        'profile-incomplete',
        'Complete client and venue details',
        'Missing profile fields reduce planner handoff quality and public-site accuracy.',
        `Missing: ${input.profile.missing.slice(0, 6).join(', ')}${input.profile.missing.length > 6 ? '…' : ''}`,
        'medium',
        'Client profile',
        {
          title: 'Complete missing client and venue profile details',
          category: 'content',
          priority: 'medium',
        },
      ),
    )
  }

  if (input.release.overCapacityTables > 0) {
    recommendations.push(
      recommendation(
        'seating-over-capacity',
        'Resolve table over-capacity',
        'Assigned headcount exceeds saved table capacity.',
        `${input.release.overCapacityTables} table${input.release.overCapacityTables === 1 ? '' : 's'} are over capacity.`,
        'critical',
        'Seating',
        {
          title: `Resolve ${input.release.overCapacityTables} over-capacity table${input.release.overCapacityTables === 1 ? '' : 's'}`,
          category: 'seating',
          priority: 'high',
        },
      ),
    )
  }

  if (input.submissions.pending > 0) {
    recommendations.push(
      recommendation(
        'submissions-pending',
        'Review pending guest content',
        'Pending submissions should be moderated before the wedding canon is sealed.',
        `${input.submissions.pending} submission${input.submissions.pending === 1 ? '' : 's'} await review.`,
        'low',
        'Closeout',
        {
          title: `Review ${input.submissions.pending} pending guest submission${input.submissions.pending === 1 ? '' : 's'}`,
          category: 'content',
          priority: 'low',
        },
      ),
    )
  }

  const severityOrder: Record<IntelligenceSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }
  return recommendations.sort(
    (left, right) => severityOrder[left.severity] - severityOrder[right.severity],
  )
}

export function buildCloseoutEvaluation(
  input: PlannerIntelligenceInput,
  now = new Date(),
): CloseoutEvaluation {
  const datePassed = input.wedding.date.getTime() <= now.getTime()
  const vendorObligations = input.vendors.unsigned + input.vendors.unpaid
  const checks: ReadinessCheck[] = [
    {
      id: 'date-passed',
      label: 'Wedding date has passed',
      detail: datePassed
        ? 'The event date is in the past.'
        : `Closeout stays locked until ${input.wedding.date.toLocaleDateString('en-US')}.`,
      complete: datePassed,
      blocking: true,
    },
    {
      id: 'tasks-closed',
      label: 'Planning tasks closed',
      detail: `${input.tasks.open} open task${input.tasks.open === 1 ? '' : 's'}.`,
      complete: input.tasks.open === 0,
      blocking: true,
      count: input.tasks.open,
    },
    {
      id: 'budget-reconciled',
      label: 'Budget reconciled',
      detail: `${money(input.budget.outstanding, input.budget.currency)} remains outstanding.`,
      complete: input.budget.outstanding <= 0.005 && input.budget.overduePayments === 0,
      blocking: true,
      count: input.budget.overduePayments,
    },
    {
      id: 'vendors-closed',
      label: 'Vendor obligations closed',
      detail: `${input.vendors.unsigned} unsigned · ${input.vendors.unpaid} unpaid.`,
      complete: vendorObligations === 0,
      blocking: true,
      count: vendorObligations,
    },
    {
      id: 'event-issues-resolved',
      label: 'Event-day issues resolved',
      detail: `${input.event.openIssues} issue${input.event.openIssues === 1 ? '' : 's'} remain open.`,
      complete: input.event.openIssues === 0,
      blocking: true,
      count: input.event.openIssues,
    },
    {
      id: 'timeline-complete',
      label: 'Run sheet completed',
      detail: `${input.timeline.incomplete} timeline item${input.timeline.incomplete === 1 ? '' : 's'} remain incomplete.`,
      complete: input.timeline.incomplete === 0,
      blocking: true,
      count: input.timeline.incomplete,
    },
    {
      id: 'imports-stable',
      label: 'Imports stable',
      detail: `${input.imports.failed} failed or rollback-failed import${input.imports.failed === 1 ? '' : 's'}.`,
      complete: input.imports.failed === 0,
      blocking: true,
      count: input.imports.failed,
    },
    {
      id: 'reminders-stable',
      label: 'Reminder delivery stable',
      detail: `${input.reminders.failed} failed reminder${input.reminders.failed === 1 ? '' : 's'}.`,
      complete: input.reminders.failed === 0,
      blocking: true,
      count: input.reminders.failed,
    },
    {
      id: 'submissions-reviewed',
      label: 'Guest content reviewed',
      detail: `${input.submissions.pending} submission${input.submissions.pending === 1 ? '' : 's'} await review.`,
      complete: input.submissions.pending === 0,
      blocking: true,
      count: input.submissions.pending,
    },
  ]

  const completed = checks.filter((check) => check.complete).length
  return {
    datePassed,
    ready: checks.every((check) => !check.blocking || check.complete),
    checks,
    completed,
    total: checks.length,
  }
}

export function buildReleaseEvaluation(input: PlannerIntelligenceInput): ReleaseEvaluation {
  const checks: ReadinessCheck[] = [
    {
      id: 'profile-complete',
      label: 'Client profile complete',
      detail: input.profile.missing.length
        ? `Missing: ${input.profile.missing.join(', ')}`
        : 'Required couple, wedding, venue, and public-site fields are present.',
      complete: input.profile.missing.length === 0,
      blocking: true,
      count: input.profile.missing.length,
    },
    {
      id: 'active-owner',
      label: 'Active owner assigned',
      detail: `${input.release.activeOwners} active owner membership${input.release.activeOwners === 1 ? '' : 's'}.`,
      complete: input.release.activeOwners > 0,
      blocking: true,
      count: input.release.activeOwners,
    },
    {
      id: 'imports-clean',
      label: 'No failed imports',
      detail: `${input.imports.failed} failed or rollback-failed import${input.imports.failed === 1 ? '' : 's'}.`,
      complete: input.imports.failed === 0,
      blocking: true,
      count: input.imports.failed,
    },
    {
      id: 'reminders-clean',
      label: 'No failed reminders',
      detail: `${input.reminders.failed} failed reminder${input.reminders.failed === 1 ? '' : 's'}.`,
      complete: input.reminders.failed === 0,
      blocking: true,
      count: input.reminders.failed,
    },
    {
      id: 'critical-issues-clear',
      label: 'No critical event issues',
      detail: `${input.event.criticalIssues} critical/high issue${input.event.criticalIssues === 1 ? '' : 's'} remain open.`,
      complete: input.event.criticalIssues === 0,
      blocking: true,
      count: input.event.criticalIssues,
    },
    {
      id: 'seating-capacity-safe',
      label: 'Seating is capacity-safe',
      detail: `${input.release.overCapacityTables} table${input.release.overCapacityTables === 1 ? '' : 's'} exceed capacity.`,
      complete: input.release.overCapacityTables === 0,
      blocking: true,
      count: input.release.overCapacityTables,
    },
    {
      id: 'privacy-valid',
      label: 'Privacy mode is explicit',
      detail: `Current privacy mode: ${input.wedding.privacy || 'not set'}.`,
      complete: ['public', 'private', 'unlisted'].includes(input.wedding.privacy),
      blocking: true,
    },
  ]
  const completed = checks.filter((check) => check.complete).length
  return {
    ready: checks.every((check) => !check.blocking || check.complete),
    checks,
    completed,
    total: checks.length,
  }
}

export function canManageWeddingCanon(role: string, permissions: readonly string[]): boolean {
  return role === 'owner' || role === 'admin' || permissions.includes('*')
}

export interface HealthEnvironmentInput {
  nodeEnv?: string
  databaseUrl?: string
  directUrl?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  serviceRoleKey?: string
  sessionSecret?: string
  siteUrl?: string
  productionSiteUrl?: string
}

function normalizedUrl(value?: string): URL | null {
  if (!value?.trim()) return null
  try {
    return new URL(value.trim())
  } catch {
    return null
  }
}

export function evaluateHealthEnvironment(input: HealthEnvironmentInput) {
  const site = normalizedUrl(input.siteUrl)
  const productionSite = normalizedUrl(input.productionSiteUrl)
  const production = input.nodeEnv === 'production'
  const siteUrlValid = Boolean(
    site &&
      ['http:', 'https:'].includes(site.protocol) &&
      (!production || site.protocol === 'https:') &&
      (!production || !['localhost', '127.0.0.1'].includes(site.hostname)),
  )
  const productionSiteMatches = productionSite
    ? Boolean(site && site.origin === productionSite.origin)
    : true

  const requiredEnvironment = {
    databaseUrl: Boolean(input.databaseUrl),
    supabaseUrl: Boolean(input.supabaseUrl),
    supabaseAnonKey: Boolean(input.supabaseAnonKey),
    sessionSecret: Boolean(input.sessionSecret && input.sessionSecret.length >= 32),
    siteUrl: Boolean(input.siteUrl),
  }
  const optionalEnvironment = {
    directUrl: Boolean(input.directUrl),
    serviceRole: Boolean(input.serviceRoleKey),
    productionSiteUrl: Boolean(input.productionSiteUrl),
  }

  return {
    production,
    siteUrlValid,
    productionSiteMatches,
    requiredEnvironment,
    optionalEnvironment,
    requiredEnvironmentReady: Object.values(requiredEnvironment).every(Boolean),
  }
}
