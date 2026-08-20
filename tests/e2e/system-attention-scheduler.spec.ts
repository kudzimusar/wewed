import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import {
  E2E_USER,
  E2E_WEDDINGS,
  resetPlannerE2EFixture,
} from './support/planner-fixture'

const CRON_AUTH = 'Bearer wewed-local-ci-cron-secret'

async function invokeScheduler(page: import('@playwright/test').Page) {
  const response = await page.request.get('/api/cron/system-reminders', {
    headers: { authorization: CRON_AUTH },
  })
  expect(response.ok(), 'protected system-reminders cron should succeed').toBe(true)
  const payload = await response.json()
  expect(payload.success).toBe(true)
  return payload as Record<string, number | boolean | string>
}

test('system reminder scheduler is protected, idempotent, snooze-safe and source-resolving', async ({ page }) => {
  await resetPlannerE2EFixture()
  const prisma = new PrismaClient()
  const now = Date.now()

  try {
    const unauthorized = await page.request.get('/api/cron/system-reminders')
    expect(unauthorized.status()).toBe(401)

    await prisma.user.create({
      data: {
        id: 'scheduler-vendor-user',
        email: 'scheduler.vendor@example.test',
        name: 'Scheduler Vendor',
        role: 'vendor',
      },
    })

    await prisma.plannerTask.create({
      data: {
        id: 'scheduler-due-task',
        title: 'Scheduler due task',
        category: 'operations',
        status: 'todo',
        priority: 'high',
        dueDate: new Date(now + 30 * 60 * 1000),
        assigneeUserId: E2E_USER.id,
        weddingId: E2E_WEDDINGS.primary.id,
      },
    })

    await prisma.budgetItem.create({
      data: {
        id: 'scheduler-due-budget',
        category: 'operations',
        description: 'Scheduler due payment',
        estimatedCost: 500,
        actualCost: 450,
        paidAmount: 100,
        currency: 'USD',
        dueDate: new Date(now + 24 * 60 * 60 * 1000),
        weddingId: E2E_WEDDINGS.primary.id,
      },
    })

    await prisma.serviceEngagement.create({
      data: {
        id: 'scheduler-due-engagement',
        origin: 'current',
        recordMode: 'managed_contract',
        lifecycleStatus: 'issued',
        serviceCategory: 'Venue',
        serviceDescription: 'Scheduler vendor service',
        serviceDate: new Date(now + 6 * 60 * 60 * 1000),
        serviceLocation: 'Primary Test Estate',
        weddingId: E2E_WEDDINGS.primary.id,
        vendorId: `${E2E_WEDDINGS.primary.id}-vendor`,
      },
    })

    await prisma.engagementParty.create({
      data: {
        id: 'scheduler-vendor-party',
        serviceEngagementId: 'scheduler-due-engagement',
        weddingId: E2E_WEDDINGS.primary.id,
        partyRole: 'SERVICE_PROVIDER',
        partyKind: 'VENDOR',
        displayName: 'Scheduler Vendor',
        userId: 'scheduler-vendor-user',
      },
    })

    await prisma.notification.create({
      data: {
        id: 'scheduler-due-snooze-notification',
        recipientUserId: E2E_USER.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'planner_task',
        sourceId: 'scheduler-due-task',
        eventType: 'uat.snooze_due',
        category: 'task',
        severity: 'important',
        title: 'Due snooze should reactivate',
        body: 'The scheduler should reactivate this notification.',
        state: 'scheduled',
        scheduledFor: new Date(now - 60 * 1000),
        snoozedUntil: new Date(now - 60 * 1000),
        dedupeKey: 'uat:scheduler:snooze-due',
      },
    })

    await prisma.reminder.create({
      data: {
        id: 'scheduler-due-snooze-reminder',
        ownerUserId: E2E_USER.id,
        recipientUserId: E2E_USER.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'notification',
        sourceId: 'scheduler-due-snooze-notification',
        triggerAt: new Date(now - 60 * 1000),
        timezone: 'UTC',
        state: 'scheduled',
        deliveryPolicy: { surface: 'in_app' },
        dedupeKey: 'uat:scheduler:reminder-due',
      },
    })

    const sourceTaskDueBefore = await prisma.plannerTask.findUniqueOrThrow({
      where: { id: 'scheduler-due-task' },
      select: { dueDate: true },
    })

    const first = await invokeScheduler(page)
    expect(Number(first.remindersActivated)).toBeGreaterThanOrEqual(1)

    const reactivated = await prisma.notification.findUniqueOrThrow({
      where: { id: 'scheduler-due-snooze-notification' },
      select: { state: true, scheduledFor: true, snoozedUntil: true },
    })
    expect(reactivated.state).toBe('active')
    expect(reactivated.scheduledFor).toBeNull()
    expect(reactivated.snoozedUntil).toBeNull()

    const completedReminder = await prisma.reminder.findUniqueOrThrow({
      where: { id: 'scheduler-due-snooze-reminder' },
      select: { state: true },
    })
    expect(completedReminder.state).toBe('completed')

    const sourceTaskDueAfterSnooze = await prisma.plannerTask.findUniqueOrThrow({
      where: { id: 'scheduler-due-task' },
      select: { dueDate: true },
    })
    expect(sourceTaskDueAfterSnooze.dueDate?.toISOString()).toBe(
      sourceTaskDueBefore.dueDate?.toISOString(),
    )

    const countsAfterFirst = {
      task: await prisma.notification.count({
        where: {
          sourceType: 'planner_task',
          sourceId: 'scheduler-due-task',
          eventType: { in: ['task.due_soon', 'task.overdue'] },
        },
      }),
      budget: await prisma.notification.count({
        where: { sourceType: 'budget_item', sourceId: 'scheduler-due-budget' },
      }),
      engagement: await prisma.notification.count({
        where: { sourceType: 'service_engagement', sourceId: 'scheduler-due-engagement' },
      }),
    }
    expect(countsAfterFirst).toEqual({ task: 1, budget: 1, engagement: 2 })

    const vendorEngagementAttention = await prisma.notification.findMany({
      where: {
        sourceType: 'service_engagement',
        sourceId: 'scheduler-due-engagement',
        recipientUserId: 'scheduler-vendor-user',
      },
      select: { category: true, deepLink: true },
    })
    expect(vendorEngagementAttention).toEqual([{ category: 'engagement', deepLink: '/vendor' }])

    await invokeScheduler(page)
    const countsAfterReplay = {
      task: await prisma.notification.count({
        where: {
          sourceType: 'planner_task',
          sourceId: 'scheduler-due-task',
          eventType: { in: ['task.due_soon', 'task.overdue'] },
        },
      }),
      budget: await prisma.notification.count({
        where: { sourceType: 'budget_item', sourceId: 'scheduler-due-budget' },
      }),
      engagement: await prisma.notification.count({
        where: { sourceType: 'service_engagement', sourceId: 'scheduler-due-engagement' },
      }),
    }
    expect(countsAfterReplay).toEqual(countsAfterFirst)

    await prisma.plannerTask.update({
      where: { id: 'scheduler-due-task' },
      data: { status: 'completed' },
    })
    await prisma.budgetItem.update({
      where: { id: 'scheduler-due-budget' },
      data: { paidAmount: 450 },
    })
    await prisma.serviceEngagement.update({
      where: { id: 'scheduler-due-engagement' },
      data: { lifecycleStatus: 'completed' },
    })

    const completionRun = await invokeScheduler(page)
    expect(Number(completionRun.sourceNotificationsResolved)).toBeGreaterThanOrEqual(4)

    const remainingTaskAttention = await prisma.notification.count({
      where: {
        sourceType: 'planner_task',
        sourceId: 'scheduler-due-task',
        state: { notIn: ['resolved', 'cancelled', 'expired'] },
      },
    })
    const remainingBudgetAttention = await prisma.notification.count({
      where: {
        sourceType: 'budget_item',
        sourceId: 'scheduler-due-budget',
        state: { notIn: ['resolved', 'cancelled', 'expired'] },
      },
    })
    const remainingEngagementAttention = await prisma.notification.count({
      where: {
        sourceType: 'service_engagement',
        sourceId: 'scheduler-due-engagement',
        state: { notIn: ['resolved', 'cancelled', 'expired'] },
      },
    })

    expect(remainingTaskAttention).toBe(0)
    expect(remainingBudgetAttention).toBe(0)
    expect(remainingEngagementAttention).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})
