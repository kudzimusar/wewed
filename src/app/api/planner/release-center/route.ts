import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildCloseoutEvaluation,
  buildPlannerRecommendations,
  buildReleaseEvaluation,
  canManageWeddingCanon,
  type PlannerIntelligenceInput,
} from '@/lib/planner-stage9'
import {
  parseJsonObject,
  type EventIssueValue,
  type TimelineStatusValue,
} from '@/lib/planner-phase6'
import {
  contextHasPermission,
  requireWeddingPermission,
  type WeddingContext,
} from '@/lib/wedding-access'

function text(value: unknown, max = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function partyHeadcount(rsvp: {
  attending: boolean | null
  plusOne: boolean
  kidsAttending: boolean
  kidsCount: number
} | null): number {
  if (rsvp?.attending !== true) return 0
  return 1 + (rsvp.plusOne ? 1 : 0) + (rsvp.kidsAttending ? rsvp.kidsCount : 0)
}

async function loadReleaseCentre(weddingId: string, context: WeddingContext) {
  const now = new Date()
  const nextSevenDays = new Date(now)
  nextSevenDays.setUTCDate(nextSevenDays.getUTCDate() + 7)

  const [
    wedding,
    tasks,
    guests,
    budget,
    vendors,
    timeline,
    tables,
    reminders,
    imports,
    eventRevisions,
    pendingSubmissions,
    pendingContributions,
    activeOwners,
  ] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      include: {
        couple: {
          select: { partner1: true, partner2: true },
        },
        contentItems: {
          where: { section: 'venue' },
          select: { field: true, value: true },
        },
      },
    }),
    db.plannerTask.findMany({ where: { weddingId } }),
    db.guest.findMany({
      where: { weddingId },
      include: { rsvp: true },
    }),
    db.budgetItem.findMany({ where: { weddingId } }),
    db.vendor.findMany({ where: { weddingId } }),
    db.programmeItem.findMany({ where: { weddingId } }),
    db.seatingTable.findMany({
      where: { weddingId },
      include: { guests: { include: { rsvp: true } } },
    }),
    db.contentRevision.findMany({
      where: { weddingId, section: 'planner_reminder' },
    }),
    db.importJob.findMany({ where: { weddingId } }),
    db.contentRevision.findMany({
      where: {
        weddingId,
        section: { in: ['event_day_issue', 'event_day_timeline_status'] },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    db.contentSubmission.count({ where: { weddingId, status: 'pending' } }),
    db.guestContribution.count({
      where: { weddingId, status: { in: ['pending', 'submitted'] } },
    }),
    db.weddingMembership.count({
      where: { weddingId, status: 'active', role: 'owner' },
    }),
  ])

  if (!wedding) return null

  const venueContent = new Map(wedding.contentItems.map((item) => [item.field, item.value.trim()]))
  const profileMissing = [
    !wedding.couple.partner1.trim() ? 'partner 1' : null,
    !wedding.couple.partner2.trim() ? 'partner 2' : null,
    !wedding.title.trim() ? 'wedding title' : null,
    !wedding.venue.trim() ? 'venue' : null,
    !wedding.venueCity.trim() ? 'venue city' : null,
    !wedding.venueCountry.trim() ? 'venue country' : null,
    !wedding.venueMapUrl?.trim() ? 'venue map' : null,
    !venueContent.get('address') ? 'venue address' : null,
    !venueContent.get('phone') ? 'venue phone' : null,
    !venueContent.get('description') ? 'venue description' : null,
  ].filter((value): value is string => Boolean(value))

  const openTasks = tasks.filter((task) => task.status !== 'done')
  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < now)
  const dueSoonTasks = openTasks.filter(
    (task) => task.dueDate && task.dueDate >= now && task.dueDate <= nextSevenDays,
  )

  const pendingGuests = guests.filter((guest) => guest.rsvp?.attending == null)
  const confirmedUnseated = guests.filter(
    (guest) => guest.rsvp?.attending === true && !guest.seatingTableId,
  )

  const actualBudget = budget.reduce(
    (total, item) => total + (item.actualCost ?? item.estimatedCost),
    0,
  )
  const paidBudget = budget.reduce((total, item) => total + item.paidAmount, 0)
  const outstandingBudget = Math.max(0, actualBudget - paidBudget)
  const overduePayments = budget.filter(
    (item) =>
      item.dueDate &&
      item.dueDate < now &&
      item.paidAmount < (item.actualCost ?? item.estimatedCost),
  ).length

  const closedContractStatuses = new Set(['signed', 'complete', 'completed'])
  const closedPaymentStatuses = new Set(['paid', 'complete', 'completed'])
  const unsignedVendors = vendors.filter(
    (vendor) => !closedContractStatuses.has(vendor.contractStatus.toLowerCase()),
  ).length
  const unpaidVendors = vendors.filter(
    (vendor) => !closedPaymentStatuses.has(vendor.paymentStatus.toLowerCase()),
  ).length
  const missingVendorContact = vendors.filter(
    (vendor) => !vendor.contact?.trim() && !vendor.phone?.trim() && !vendor.website?.trim(),
  ).length

  const timelineStatus = new Map<string, TimelineStatusValue>()
  const openIssues: Array<EventIssueValue & { status: string }> = []
  for (const revision of eventRevisions) {
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
    if (revision.section === 'event_day_issue' && revision.status !== 'resolved') {
      openIssues.push({
        status: revision.status,
        ...parseJsonObject<EventIssueValue>(revision.value, {
          title: revision.fieldKey,
          notes: '',
          severity: 'medium',
          owner: '',
          createdAt: revision.createdAt.toISOString(),
          resolvedAt: null,
          resolvedBy: null,
        }),
      })
    }
  }
  const incompleteTimeline = timeline.filter(
    (item) => timelineStatus.get(item.id)?.status !== 'complete',
  ).length
  const criticalIssues = openIssues.filter(
    (issue) => issue.severity === 'critical' || issue.severity === 'high',
  ).length

  const failedReminders = reminders.filter((reminder) => reminder.status === 'failed').length
  const failedImports = imports.filter(
    (job) => job.status === 'failed' || job.status === 'rollback_failed',
  ).length
  const overCapacityTables = tables.filter((table) => {
    const occupied = table.guests.reduce(
      (total, guest) => total + partyHeadcount(guest.rsvp),
      0,
    )
    return occupied > table.capacity
  }).length

  const input: PlannerIntelligenceInput = {
    wedding: {
      title: wedding.title,
      date: wedding.date,
      lifecycle: wedding.lifecycle,
      privacy: wedding.privacy,
      canonSealed: wedding.canonSealed,
    },
    tasks: {
      open: openTasks.length,
      overdue: overdueTasks.length,
      dueSoon: dueSoonTasks.length,
    },
    guests: {
      pending: pendingGuests.length,
      confirmedUnseated: confirmedUnseated.length,
      withoutEmail: guests.filter((guest) => !guest.email?.trim()).length,
    },
    budget: {
      outstanding: outstandingBudget,
      overduePayments,
      currency: budget[0]?.currency ?? 'USD',
    },
    vendors: {
      unsigned: unsignedVendors,
      unpaid: unpaidVendors,
      missingContact: missingVendorContact,
    },
    timeline: {
      total: timeline.length,
      incomplete: incompleteTimeline,
    },
    event: {
      openIssues: openIssues.length,
      criticalIssues,
    },
    reminders: { failed: failedReminders },
    imports: { failed: failedImports },
    submissions: { pending: pendingSubmissions + pendingContributions },
    profile: { missing: profileMissing },
    release: {
      activeOwners,
      overCapacityTables,
    },
  }

  const recommendations = buildPlannerRecommendations(input)
  const closeout = buildCloseoutEvaluation(input, now)
  const release = buildReleaseEvaluation(input)

  return {
    input,
    recommendations,
    closeout,
    release,
    public: {
      success: true,
      generatedAt: now.toISOString(),
      wedding: {
        id: wedding.id,
        title: wedding.title,
        date: wedding.date.toISOString(),
        lifecycle: wedding.lifecycle,
        privacy: wedding.privacy,
        canonSealed: wedding.canonSealed,
        canonSealedAt: wedding.canonSealedAt?.toISOString() ?? null,
      },
      permissions: {
        canEdit: contextHasPermission(context, 'planner.edit'),
        canManageCanon: canManageWeddingCanon(context.role, context.permissions),
      },
      intelligence: {
        externalModel: false,
        explanation:
          'Recommendations are generated deterministically from this selected wedding’s saved operational records. No client data is sent to an external AI provider.',
        recommendations,
      },
      closeout,
      release,
    },
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const centre = await loadReleaseCentre(access.context.weddingId, access.context)
    if (!centre) {
      return NextResponse.json({ success: false, error: 'Active wedding not found.' }, { status: 404 })
    }
    return NextResponse.json(centre.public)
  } catch (error) {
    console.error('[planner release centre GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load planner intelligence and closeout.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'A JSON action is required.' }, { status: 400 })
  }

  const action = text(body.action, 80)
  const permission =
    action === 'seal_canon' || action === 'reopen_canon' ? 'content.edit' : 'planner.edit'
  const access = await requireWeddingPermission(request, permission)
  if (access.error) return access.error

  try {
    const centre = await loadReleaseCentre(access.context.weddingId, access.context)
    if (!centre) {
      return NextResponse.json({ success: false, error: 'Active wedding not found.' }, { status: 404 })
    }

    const weddingId = access.context.weddingId
    const actorId = access.context.session.userId
    const confirmation = text(body.confirmation, 240)

    if (action === 'create_recommendation_task') {
      const recommendationId = text(body.recommendationId, 120)
      const recommendation = centre.recommendations.find(
        (candidate) => candidate.id === recommendationId && candidate.task,
      )
      if (!recommendation?.task) {
        return NextResponse.json(
          { success: false, error: 'This recommendation is no longer active or cannot create a task.' },
          { status: 409 },
        )
      }

      const marker = `[intelligence:${recommendation.id}]`
      const existing = await db.plannerTask.findFirst({
        where: {
          weddingId,
          status: { not: 'done' },
          OR: [
            { title: recommendation.task.title },
            { description: { contains: marker } },
          ],
        },
      })
      if (existing) {
        return NextResponse.json({ success: true, duplicate: true, data: existing })
      }

      const last = await db.plannerTask.findFirst({
        where: { weddingId },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      const dueDate = new Date()
      dueDate.setUTCDate(dueDate.getUTCDate() + 3)

      const created = await db.$transaction(async (tx) => {
        const task = await tx.plannerTask.create({
          data: {
            weddingId,
            title: recommendation.task!.title,
            description: `${marker}\n${recommendation.reason}\nEvidence: ${recommendation.evidence}`,
            category: recommendation.task!.category,
            priority: recommendation.task!.priority,
            status: 'todo',
            dueDate,
            order: (last?.order ?? 0) + 1,
          },
        })
        await tx.auditEvent.create({
          data: {
            action: 'intelligence.task_create',
            resourceType: 'planner_task',
            resourceId: task.id,
            afterValue: JSON.stringify({
              recommendationId: recommendation.id,
              title: task.title,
              evidence: recommendation.evidence,
            }),
            weddingId,
            actorId,
          },
        })
        return task
      })

      return NextResponse.json({ success: true, duplicate: false, data: created }, { status: 201 })
    }

    if (action === 'complete_closeout') {
      if (confirmation !== centre.input.wedding.title) {
        return NextResponse.json(
          { success: false, error: 'Type the wedding title exactly to confirm closeout.' },
          { status: 400 },
        )
      }
      if (!centre.closeout.datePassed || !centre.closeout.ready) {
        return NextResponse.json(
          { success: false, error: 'Closeout blockers must be cleared and the wedding date must pass first.' },
          { status: 409 },
        )
      }

      const current = await db.wedding.findUnique({
        where: { id: weddingId },
        select: { lifecycle: true },
      })
      if (!current) {
        return NextResponse.json({ success: false, error: 'Active wedding not found.' }, { status: 404 })
      }
      if (current.lifecycle !== 'after') {
        await db.$transaction([
          db.wedding.update({ where: { id: weddingId }, data: { lifecycle: 'after' } }),
          db.auditEvent.create({
            data: {
              action: 'closeout.lifecycle_after',
              resourceType: 'wedding',
              resourceId: weddingId,
              beforeValue: JSON.stringify({ lifecycle: current.lifecycle }),
              afterValue: JSON.stringify({ lifecycle: 'after' }),
              weddingId,
              actorId,
            },
          }),
        ])
      }
      return NextResponse.json({ success: true, lifecycle: 'after' })
    }

    if (action === 'seal_canon' || action === 'reopen_canon') {
      if (!canManageWeddingCanon(access.context.role, access.context.permissions)) {
        return NextResponse.json(
          { success: false, error: 'Only an owner or administrator can manage the wedding canon.' },
          { status: 403 },
        )
      }
      if (confirmation !== centre.input.wedding.title) {
        return NextResponse.json(
          { success: false, error: 'Type the wedding title exactly to confirm this canon action.' },
          { status: 400 },
        )
      }

      const seal = action === 'seal_canon'
      if (seal && (centre.input.wedding.lifecycle !== 'after' || !centre.closeout.ready)) {
        return NextResponse.json(
          { success: false, error: 'Complete post-wedding closeout before sealing the canon.' },
          { status: 409 },
        )
      }

      await db.$transaction([
        db.wedding.update({
          where: { id: weddingId },
          data: {
            canonSealed: seal,
            canonSealedAt: seal ? new Date() : null,
          },
        }),
        db.auditEvent.create({
          data: {
            action: seal ? 'closeout.canon_seal' : 'closeout.canon_reopen',
            resourceType: 'wedding',
            resourceId: weddingId,
            beforeValue: JSON.stringify({ canonSealed: centre.input.wedding.canonSealed }),
            afterValue: JSON.stringify({ canonSealed: seal }),
            weddingId,
            actorId,
          },
        }),
      ])
      return NextResponse.json({ success: true, canonSealed: seal })
    }

    return NextResponse.json({ success: false, error: 'Unknown release-centre action.' }, { status: 400 })
  } catch (error) {
    console.error('[planner release centre POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to complete the release-centre action.' },
      { status: 500 },
    )
  }
}
