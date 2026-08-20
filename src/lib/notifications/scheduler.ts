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

async function resolveCompletedSourceNotifications(stats: SchedulerStats) {
  const taskResolved = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'resolved',
          "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM public."PlannerTask" t
      WHERE n."sourceType" = 'planner_task'
        AND n."sourceId" = t.id
        AND LOWER(t.status) IN ('done', 'completed')
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
  )

  const budgetResolved = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'resolved',
          "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM public."BudgetItem" b
      WHERE n."sourceType" = 'budget_item'
        AND n."sourceId" = b.id
        AND b."paidAmount" >= COALESCE(b."actualCost", b."estimatedCost")
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
  )

  const engagementResolved = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'resolved',
          "resolvedAt" = COALESCE(n."resolvedAt", CURRENT_TIMESTAMP),
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM public."ServiceEngagement" se
      WHERE n."sourceType" = 'service_engagement'
        AND n."sourceId" = se.id
        AND LOWER(se."lifecycleStatus") IN ('completed', 'cancelled', 'closed')
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
  )

  const contractReviewExpired = await db.$executeRawUnsafe(
    `
      UPDATE public."Notification" n
      SET state = 'expired',
          "readAt" = COALESCE(n."readAt", CURRENT_TIMESTAMP),
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM public."ContractReviewGrant" crg
      JOIN public."ContractVersion" cv
        ON cv.id = crg."contractVersionId" AND cv."contractId" = crg."contractId"
      WHERE n."sourceType" = 'contract_review_grant'
        AND n."sourceId" = crg.id
        AND (
          crg.status <> 'ACTIVE'
          OR crg."revokedAt" IS NOT NULL
          OR crg."expiresAt" <= CURRENT_TIMESTAMP
          OR cv.status NOT IN ('ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED')
        )
        AND n.state NOT IN ('resolved', 'cancelled', 'expired')
    `,
  )

  stats.sourceNotificationsResolved +=
    taskResolved + budgetResolved + engagementResolved + contractReviewExpired
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
          dedupeKey: `task:${task.id}:${overdue ? 'overdue' : 'due-24h'}`,
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
          dedupeKey: `budget:${item.id}:${overdue ? 'overdue' : 'due-3d'}`,
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
          dedupeKey: `wedding:${wedding.id}:rsvp-7d`,
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
        AND LOWER("lifecycleStatus") NOT IN ('completed', 'cancelled', 'closed')
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
          dedupeKey: `engagement:${engagement.id}:service-24h:planning`,
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
      `,
      engagement.id,
      engagement.weddingId,
    )

    for (const recipient of vendorRecipients) {
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
          dedupeKey: `engagement:${engagement.id}:service-24h:vendor`,
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
        dedupeKey: `contract-review-grant:${grant.id}:expires-24h`,
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

  await resolveCompletedSourceNotifications(stats)
  await processDueSnoozes(now, reminderLimit, stats)
  await seedTaskNotifications(now, stats)
  await seedBudgetNotifications(now, stats)
  await seedRsvpNotifications(now, stats)
  await seedEngagementNotifications(now, stats)
  await seedContractReviewExpiryNotifications(now, stats)
  await seedAdminDeliveryFailureNotifications(stats)

  return stats
}
