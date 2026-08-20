import { db } from '@/lib/db'
import { createNotification, NotificationAccessError } from '@/lib/notifications/service'
import type { ReminderRecord } from '@/lib/notifications/contracts'

export interface SchedulerStats {
  dueReminders: number
  remindersActivated: number
  remindersSkipped: number
  notificationsCreated: number
  adapterSkipped: number
  sourceNotificationsResolved: number
}

async function activePlanningRecipients(weddingId: string): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<Array<{ userId: string }>>(
    `
      SELECT DISTINCT "userId"
      FROM public."WeddingMembership"
      WHERE "weddingId" = $1
        AND status = 'active'
        AND role IN ('owner', 'planner', 'coordinator')
    `,
    weddingId,
  )
  return rows.map((row) => row.userId)
}

async function createSafely(
  input: Parameters<typeof createNotification>[0],
  stats: SchedulerStats,
) {
  try {
    await createNotification(input)
    stats.notificationsCreated += 1
  } catch (error) {
    if (error instanceof NotificationAccessError) {
      stats.adapterSkipped += 1
      return
    }
    throw error
  }
}

async function resolveSupersededSourceNotifications(input: {
  recipientUserId: string
  sourceType: string
  sourceId: string
  eventType: string
  alternateEventType?: string | null
  keepDedupeKey: string
}, stats: SchedulerStats) {
  const count = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'resolved',
          "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "scheduledFor" = NULL,
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE n."recipientUserId" = $1
        AND n."sourceType" = $2
        AND n."sourceId" = $3
        AND (n."eventType" = $4 OR ($5::text IS NOT NULL AND n."eventType" = $5))
        AND n."dedupeKey" IS DISTINCT FROM $6
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
    input.recipientUserId,
    input.sourceType,
    input.sourceId,
    input.eventType,
    input.alternateEventType ?? null,
    input.keepDedupeKey,
  )
  stats.sourceNotificationsResolved += count
}

async function processDueSnoozes(now: Date, limit: number, stats: SchedulerStats) {
  const due = await db.$queryRawUnsafe<ReminderRecord[]>(
    `
      SELECT *
      FROM public."Reminder"
      WHERE state = 'scheduled'
        AND "triggerAt" <= $1
      ORDER BY "triggerAt" ASC
      LIMIT $2
    `,
    now,
    limit,
  )
  stats.dueReminders = due.length

  for (const reminder of due) {
    const claimed = await db.$queryRawUnsafe<ReminderRecord[]>(
      `
        UPDATE public."Reminder"
        SET state = 'triggered', "triggeredAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND state = 'scheduled' AND "triggerAt" <= $2
        RETURNING *
      `,
      reminder.id,
      now,
    )
    if (!claimed[0]) {
      stats.remindersSkipped += 1
      continue
    }

    try {
      if (reminder.sourceType === 'notification' && reminder.sourceId) {
        const activated = await db.$executeRawUnsafe(
          `
            UPDATE public."Notification"
            SET state = 'active',
                "scheduledFor" = NULL,
                "snoozedUntil" = NULL,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $1
              AND "recipientUserId" = $2
              AND state = 'scheduled'
          `,
          reminder.sourceId,
          reminder.recipientUserId,
        )

        await db.$executeRawUnsafe(
          `
            UPDATE public."Reminder"
            SET state = 'completed', "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $1 AND state = 'triggered'
          `,
          reminder.id,
        )

        if (activated > 0) stats.remindersActivated += 1
        else stats.remindersSkipped += 1
        continue
      }

      await db.$executeRawUnsafe(
        `
          UPDATE public."Reminder"
          SET state = 'failed',
              "lastError" = 'Unsupported reminder source type for system scheduler.',
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1 AND state = 'triggered'
        `,
        reminder.id,
      )
      stats.remindersSkipped += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reminder processing failed.'
      await db.$executeRawUnsafe(
        `
          UPDATE public."Reminder"
          SET state = 'failed', "lastError" = $2, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        reminder.id,
        message.slice(0, 2000),
      )
      stats.remindersSkipped += 1
    }
  }
}

async function resolveStaleSourceNotifications(now: Date, stats: SchedulerStats) {
  const taskHorizon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const budgetHorizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const rsvpHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const engagementHorizon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const contractHorizon = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const orphaned = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'resolved',
          "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "scheduledFor" = NULL,
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE n.state NOT IN ('resolved', 'cancelled', 'expired')
        AND (
          (n."sourceType" = 'planner_task' AND NOT EXISTS (
            SELECT 1 FROM public."PlannerTask" t WHERE t.id = n."sourceId"
          ))
          OR (n."sourceType" = 'budget_item' AND NOT EXISTS (
            SELECT 1 FROM public."BudgetItem" b WHERE b.id = n."sourceId"
          ))
          OR (n."sourceType" = 'service_engagement' AND NOT EXISTS (
            SELECT 1 FROM public."ServiceEngagement" se WHERE se.id = n."sourceId"
          ))
          OR (n."eventType" = 'rsvp.deadline_approaching' AND NOT EXISTS (
            SELECT 1 FROM public."Wedding" w WHERE w.id = n."sourceId"
          ))
          OR (n."sourceType" = 'contract_review_grant' AND NOT EXISTS (
            SELECT 1 FROM public."ContractReviewGrant" crg WHERE crg.id = n."sourceId"
          ))
        )
    `,
  )

  const taskResolved = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'resolved',
          "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "scheduledFor" = NULL,
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM public."PlannerTask" t
      WHERE n."sourceType" = 'planner_task'
        AND n."sourceId" = t.id
        AND n."eventType" IN ('task.due_soon', 'task.overdue')
        AND (
          LOWER(t.status) IN ('done', 'completed')
          OR (n."eventType" = 'task.due_soon' AND (
            t."dueDate" IS NULL OR t."dueDate" < $1 OR t."dueDate" > $2
          ))
          OR (n."eventType" = 'task.overdue' AND (
            t."dueDate" IS NULL OR t."dueDate" >= $1
          ))
        )
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
    now,
    taskHorizon,
  )

  const budgetResolved = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'resolved',
          "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "scheduledFor" = NULL,
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM public."BudgetItem" b
      WHERE n."sourceType" = 'budget_item'
        AND n."sourceId" = b.id
        AND n."eventType" IN ('payment.due_soon', 'payment.overdue')
        AND (
          b."paidAmount" >= COALESCE(b."actualCost", b."estimatedCost")
          OR (n."eventType" = 'payment.due_soon' AND (
            b."dueDate" IS NULL OR b."dueDate" < $1 OR b."dueDate" > $2
          ))
          OR (n."eventType" = 'payment.overdue' AND (
            b."dueDate" IS NULL OR b."dueDate" >= $1
          ))
        )
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
    now,
    budgetHorizon,
  )

  const rsvpResolved = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'resolved',
          "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "scheduledFor" = NULL,
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM public."Wedding" w
      WHERE n."eventType" = 'rsvp.deadline_approaching'
        AND n."sourceType" = 'wedding'
        AND n."sourceId" = w.id
        AND (w."rsvpDeadline" IS NULL OR w."rsvpDeadline" < $1 OR w."rsvpDeadline" > $2)
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
    now,
    rsvpHorizon,
  )

  const engagementResolved = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'resolved',
          "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "scheduledFor" = NULL,
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM public."ServiceEngagement" se
      WHERE n."sourceType" = 'service_engagement'
        AND n."sourceId" = se.id
        AND n."eventType" = 'engagement.service_due_soon'
        AND (
          se."serviceDate" IS NULL
          OR se."serviceDate" < $1
          OR se."serviceDate" > $2
          OR LOWER(se."lifecycleStatus") IN ('completed', 'cancelled')
        )
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
    now,
    engagementHorizon,
  )

  const contractReviewExpired = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = CASE WHEN crg."expiresAt" <= $1 THEN 'expired' ELSE 'resolved' END,
          "resolvedAt" = CASE
            WHEN crg."expiresAt" <= $1 THEN n."resolvedAt"
            ELSE COALESCE(n."resolvedAt", CURRENT_TIMESTAMP)
          END,
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "scheduledFor" = NULL,
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM public."ContractReviewGrant" crg
      JOIN public."ContractVersion" cv
        ON cv.id = crg."contractVersionId" AND cv."contractId" = crg."contractId"
      WHERE n."sourceType" = 'contract_review_grant'
        AND n."sourceId" = crg.id
        AND n."eventType" = 'contract.review_access_expiring'
        AND (
          crg.status <> 'ACTIVE'
          OR crg."revokedAt" IS NOT NULL
          OR crg."expiresAt" <= $1
          OR crg."expiresAt" > $2
          OR cv.status NOT IN ('ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED')
        )
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
    now,
    contractHorizon,
  )

  stats.sourceNotificationsResolved +=
    orphaned + taskResolved + budgetResolved + rsvpResolved + engagementResolved + contractReviewExpired
}

async function cancelTerminalNotificationReminders() {
  await db.$executeRawUnsafe(
    `
      UPDATE public."Reminder" r
      SET state = 'cancelled',
          "cancelledAt" = COALESCE(r."cancelledAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE r.state = 'scheduled'
        AND r."sourceType" = 'notification'
        AND EXISTS (
          SELECT 1
          FROM public."Notification" n
          WHERE n.id = r."sourceId"
            AND n."recipientUserId" = r."recipientUserId"
            AND n.state IN ('resolved', 'cancelled', 'expired', 'dismissed')
        )
    `,
  )
}

async function seedTaskNotifications(now: Date, stats: SchedulerStats) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const rows = await db.$queryRawUnsafe<
    Array<{
      id: string
      weddingId: string
      title: string
      dueDate: Date
      priority: string
      status: string
      assigneeUserId: string | null
    }>
  >(
    `
      SELECT id, "weddingId", title, "dueDate", priority, status, "assigneeUserId"
      FROM public."PlannerTask"
      WHERE "dueDate" IS NOT NULL
        AND "dueDate" <= $1
        AND LOWER(status) NOT IN ('done', 'completed')
      ORDER BY "dueDate" ASC
      LIMIT 150
    `,
    horizon,
  )

  for (const task of rows) {
    const overdue = task.dueDate.getTime() < now.getTime()
    const recipients = task.assigneeUserId
      ? [task.assigneeUserId]
      : await activePlanningRecipients(task.weddingId)

    for (const recipientUserId of recipients) {
      const dedupeKey = `task:${task.id}:${overdue ? 'overdue' : 'due-24h'}:${task.dueDate.toISOString()}`
      await resolveSupersededSourceNotifications({
        recipientUserId,
        sourceType: 'planner_task',
        sourceId: task.id,
        eventType: 'task.due_soon',
        alternateEventType: 'task.overdue',
        keepDedupeKey: dedupeKey,
      }, stats)
      await createSafely(
        {
          recipientUserId,
          weddingId: task.weddingId,
          sourceType: 'planner_task',
          sourceId: task.id,
          eventType: overdue ? 'task.overdue' : 'task.due_soon',
          category: 'task',
          severity: overdue || task.priority.toLowerCase() === 'high' ? 'action_required' : 'important',
          title: overdue ? `Overdue: ${task.title}` : `Due soon: ${task.title}`,
          body: overdue
            ? 'This task has passed its due date and still needs attention.'
            : 'This task is due within the next 24 hours.',
          requiresAction: true,
          deepLink: '/planner/tasks',
          actionType: 'open_task',
          dedupeKey,
          metadata: { dueDate: task.dueDate.toISOString(), priority: task.priority },
        },
        stats,
      )
    }
  }
}

async function seedBudgetNotifications(now: Date, stats: SchedulerStats) {
  const horizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const rows = await db.$queryRawUnsafe<
    Array<{
      id: string
      weddingId: string
      description: string
      dueDate: Date
      currency: string
      estimatedCost: number
      actualCost: number | null
      paidAmount: number
      vendorName: string | null
    }>
  >(
    `
      SELECT id, "weddingId", description, "dueDate", currency, "estimatedCost",
             "actualCost", "paidAmount", "vendorName"
      FROM public."BudgetItem"
      WHERE "dueDate" IS NOT NULL
        AND "dueDate" <= $1
        AND "paidAmount" < COALESCE("actualCost", "estimatedCost")
      ORDER BY "dueDate" ASC
      LIMIT 100
    `,
    horizon,
  )

  for (const item of rows) {
    const overdue = item.dueDate.getTime() < now.getTime()
    const expected = Number(item.actualCost ?? item.estimatedCost)
    const outstanding = Math.max(0, expected - Number(item.paidAmount))
    const recipients = await activePlanningRecipients(item.weddingId)

    for (const recipientUserId of recipients) {
      const dedupeKey = `budget:${item.id}:${overdue ? 'overdue' : 'due-3d'}:${item.dueDate.toISOString()}`
      await resolveSupersededSourceNotifications({
        recipientUserId,
        sourceType: 'budget_item',
        sourceId: item.id,
        eventType: 'payment.due_soon',
        alternateEventType: 'payment.overdue',
        keepDedupeKey: dedupeKey,
      }, stats)
      await createSafely(
        {
          recipientUserId,
          weddingId: item.weddingId,
          sourceType: 'budget_item',
          sourceId: item.id,
          eventType: overdue ? 'payment.overdue' : 'payment.due_soon',
          category: 'payment',
          severity: overdue ? 'action_required' : 'important',
          title: overdue
            ? `Payment overdue: ${item.vendorName || item.description}`
            : `Payment due soon: ${item.vendorName || item.description}`,
          body: `${item.currency} ${outstanding.toFixed(2)} remains outstanding.`,
          requiresAction: true,
          deepLink: '/planner/budget',
          actionType: 'open_payment',
          dedupeKey,
          metadata: { dueDate: item.dueDate.toISOString(), outstanding, currency: item.currency },
        },
        stats,
      )
    }
  }
}

async function seedRsvpNotifications(now: Date, stats: SchedulerStats) {
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const rows = await db.$queryRawUnsafe<
    Array<{ id: string; title: string; rsvpDeadline: Date }>
  >(
    `
      SELECT id, title, "rsvpDeadline"
      FROM public."Wedding"
      WHERE "rsvpDeadline" IS NOT NULL
        AND "rsvpDeadline" >= $1
        AND "rsvpDeadline" <= $2
      ORDER BY "rsvpDeadline" ASC
      LIMIT 100
    `,
    now,
    horizon,
  )

  for (const wedding of rows) {
    const recipients = await activePlanningRecipients(wedding.id)
    for (const recipientUserId of recipients) {
      const dedupeKey = `wedding:${wedding.id}:rsvp-7d:${wedding.rsvpDeadline.toISOString()}`
      await resolveSupersededSourceNotifications({
        recipientUserId,
        sourceType: 'wedding',
        sourceId: wedding.id,
        eventType: 'rsvp.deadline_approaching',
        keepDedupeKey: dedupeKey,
      }, stats)
      await createSafely(
        {
          recipientUserId,
          weddingId: wedding.id,
          sourceType: 'wedding',
          sourceId: wedding.id,
          eventType: 'rsvp.deadline_approaching',
          category: 'rsvp',
          severity: 'important',
          title: 'RSVP deadline approaching',
          body: `Guest responses for ${wedding.title} are due within 7 days.`,
          requiresAction: false,
          deepLink: '/planner/guests',
          actionType: 'open_guests',
          dedupeKey,
          metadata: { rsvpDeadline: wedding.rsvpDeadline.toISOString() },
        },
        stats,
      )
    }
  }
}

async function seedEngagementNotifications(now: Date, stats: SchedulerStats) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
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
      WHERE "serviceDate" IS NOT NULL
        AND "serviceDate" >= $1
        AND "serviceDate" <= $2
        AND LOWER("lifecycleStatus") NOT IN ('completed', 'cancelled')
      ORDER BY "serviceDate" ASC
      LIMIT 100
    `,
    now,
    horizon,
  )

  for (const engagement of rows) {
    const label = engagement.serviceDescription || engagement.serviceCategory
    const plannerRecipients = await activePlanningRecipients(engagement.weddingId)
    for (const recipientUserId of plannerRecipients) {
      const dedupeKey = `engagement:${engagement.id}:service-24h:planning:${engagement.serviceDate.toISOString()}`
      await resolveSupersededSourceNotifications({
        recipientUserId,
        sourceType: 'service_engagement',
        sourceId: engagement.id,
        eventType: 'engagement.service_due_soon',
        keepDedupeKey: dedupeKey,
      }, stats)
      await createSafely(
        {
          recipientUserId,
          weddingId: engagement.weddingId,
          sourceType: 'service_engagement',
          sourceId: engagement.id,
          eventType: 'engagement.service_due_soon',
          category: 'engagement',
          severity: 'important',
          title: `Service due soon: ${label}`,
          body: engagement.serviceLocation
            ? `Scheduled within 24 hours at ${engagement.serviceLocation}.`
            : 'Scheduled within the next 24 hours.',
          requiresAction: false,
          deepLink: '/planner/vendors',
          actionType: 'open_engagement',
          dedupeKey,
          metadata: { serviceDate: engagement.serviceDate.toISOString() },
        },
        stats,
      )
    }

    const vendorRecipients = await db.$queryRawUnsafe<Array<{ userId: string }>>(
      `
        SELECT DISTINCT "userId"
        FROM public."EngagementParty"
        WHERE "serviceEngagementId" = $1
          AND "weddingId" = $2
          AND "userId" IS NOT NULL
          AND status = 'active'
          AND "partyRole" = 'SERVICE_PROVIDER'
          AND "partyKind" = 'VENDOR'
      `,
      engagement.id,
      engagement.weddingId,
    )

    for (const recipient of vendorRecipients) {
      const dedupeKey = `engagement:${engagement.id}:service-24h:vendor:${engagement.serviceDate.toISOString()}`
      await resolveSupersededSourceNotifications({
        recipientUserId: recipient.userId,
        sourceType: 'service_engagement',
        sourceId: engagement.id,
        eventType: 'engagement.service_due_soon',
        keepDedupeKey: dedupeKey,
      }, stats)
      await createSafely(
        {
          recipientUserId: recipient.userId,
          weddingId: engagement.weddingId,
          sourceType: 'service_engagement',
          sourceId: engagement.id,
          eventType: 'engagement.service_due_soon',
          category: 'engagement',
          severity: 'action_required',
          title: `Upcoming service: ${label}`,
          body: engagement.serviceLocation
            ? `Your Wewed engagement is scheduled within 24 hours at ${engagement.serviceLocation}.`
            : 'Your Wewed engagement is scheduled within the next 24 hours.',
          requiresAction: true,
          deepLink: '/vendor',
          actionType: 'open_engagement',
          dedupeKey,
          metadata: { serviceDate: engagement.serviceDate.toISOString() },
        },
        stats,
      )
    }
  }
}

async function seedContractReviewExpiryNotifications(now: Date, stats: SchedulerStats) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const rows = await db.$queryRawUnsafe<
    Array<{
      id: string
      contractId: string
      contractVersionId: string
      weddingId: string
      contractNumber: string
      title: string
      expiresAt: Date
      userId: string
      partyRole: string
    }>
  >(
    `
      SELECT crg.id, crg."contractId", crg."contractVersionId", c."weddingId",
             c."contractNumber", c.title, crg."expiresAt", ep."userId", ep."partyRole"
      FROM public."ContractReviewGrant" crg
      JOIN public."Contract" c ON c.id = crg."contractId"
      JOIN public."ContractVersion" cv
        ON cv.id = crg."contractVersionId" AND cv."contractId" = crg."contractId"
      JOIN public."EngagementParty" ep ON ep.id = crg."engagementPartyId"
      WHERE crg.status = 'ACTIVE'
        AND crg."revokedAt" IS NULL
        AND crg."expiresAt" > $1
        AND crg."expiresAt" <= $2
        AND cv.status IN ('ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED')
        AND ep."userId" IS NOT NULL
        AND ep.status = 'active'
        AND ep."partyRole" = 'SERVICE_PROVIDER'
        AND ep."partyKind" = 'VENDOR'
      ORDER BY crg."expiresAt" ASC
      LIMIT 100
    `,
    now,
    horizon,
  )

  for (const grant of rows) {
    const dedupeKey = `contract-review-grant:${grant.id}:expires-24h:${grant.expiresAt.toISOString()}`
    await resolveSupersededSourceNotifications({
      recipientUserId: grant.userId,
      sourceType: 'contract_review_grant',
      sourceId: grant.id,
      eventType: 'contract.review_access_expiring',
      keepDedupeKey: dedupeKey,
    }, stats)
    await createSafely(
      {
        recipientUserId: grant.userId,
        weddingId: grant.weddingId,
        sourceType: 'contract_review_grant',
        sourceId: grant.id,
        eventType: 'contract.review_access_expiring',
        category: 'contract',
        severity: 'action_required',
        title: `Contract review link expires soon: ${grant.title}`,
        body: `Your authorized Wewed review access for ${grant.contractNumber} expires within 24 hours.`,
        requiresAction: true,
        deepLink: '/vendor',
        actionType: 'review_contract',
        expiresAt: grant.expiresAt,
        dedupeKey,
        metadata: {
          contractId: grant.contractId,
          contractVersionId: grant.contractVersionId,
          contractNumber: grant.contractNumber,
          expiresAt: grant.expiresAt.toISOString(),
          partyRole: grant.partyRole,
        },
      },
      stats,
    )
  }
}

async function seedAdminDeliveryFailureNotifications(stats: SchedulerStats) {
  const failures = await db.$queryRawUnsafe<
    Array<{ id: string; notificationId: string; channel: string; errorMessage: string | null }>
  >(
    `
      SELECT id, "notificationId", channel, "errorMessage"
      FROM public."NotificationDeliveryAttempt"
      WHERE state = 'failed'
        AND "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY "createdAt" DESC
      LIMIT 50
    `,
  )
  if (!failures.length) return

  const admins = await db.$queryRawUnsafe<Array<{ userId: string }>>(
    `
      SELECT DISTINCT bam."userId"
      FROM public."BusinessAccountMember" bam
      JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
      WHERE bam.status = 'active'
        AND ba.type = 'wewed_internal'
        AND ba.status = 'active'
        AND bam.role IN (
          'wewed_super_admin',
          'wewed_operations_admin',
          'wewed_billing_admin',
          'wewed_support_admin'
        )
    `,
  )

  for (const failure of failures) {
    for (const admin of admins) {
      await createSafely(
        {
          recipientUserId: admin.userId,
          sourceType: 'notification_delivery_attempt',
          sourceId: failure.id,
          eventType: 'admin.notification_delivery_failed',
          category: 'admin',
          severity: 'important',
          title: `${failure.channel} notification delivery failed`,
          body: failure.errorMessage || 'A notification delivery attempt failed and needs operational review.',
          requiresAction: true,
          deepLink: '/admin',
          actionType: 'review_delivery_failure',
          dedupeKey: `admin:notification-delivery-failed:${failure.id}`,
          metadata: { notificationId: failure.notificationId, channel: failure.channel },
        },
        stats,
      )
    }
  }
}

export async function runSystemNotificationScheduler(
  now = new Date(),
  reminderLimit = 50,
): Promise<SchedulerStats> {
  const stats: SchedulerStats = {
    dueReminders: 0,
    remindersActivated: 0,
    remindersSkipped: 0,
    notificationsCreated: 0,
    adapterSkipped: 0,
    sourceNotificationsResolved: 0,
  }

  await resolveStaleSourceNotifications(now, stats)
  await cancelTerminalNotificationReminders()
  await processDueSnoozes(now, reminderLimit, stats)
  await seedTaskNotifications(now, stats)
  await seedBudgetNotifications(now, stats)
  await seedRsvpNotifications(now, stats)
  await seedEngagementNotifications(now, stats)
  await seedContractReviewExpiryNotifications(now, stats)
  await seedAdminDeliveryFailureNotifications(stats)
  await cancelTerminalNotificationReminders()

  return stats
}
