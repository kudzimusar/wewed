import { PrismaClient } from '@prisma/client'
import { E2E_USER } from './support/planner-fixture'
import { E2E_WEDDINGS, expect, test } from './support/planner-browser'

test('notification listing authorizes before limiting and snooze removes current attention', async ({ plannerPage: page }) => {
  const prisma = new PrismaClient()

  try {
    await prisma.weddingMembership.update({
      where: {
        userId_weddingId: {
          userId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.secondary.id,
        },
      },
      data: { status: 'revoked', revokedAt: new Date() },
    })

    // These rows deliberately outrank valid rows. Authorization must run before the caller's
    // requested limit so revoked data cannot crowd legitimate attention out of the response.
    await prisma.notification.createMany({
      data: Array.from({ length: 120 }, (_, index) => ({
        id: `listing-revoked-${index}`,
        recipientUserId: E2E_USER.id,
        weddingId: E2E_WEDDINGS.secondary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.secondary.id}-task`,
        eventType: 'uat.revoked-window',
        category: 'task',
        severity: 'urgent',
        title: `Revoked wedding attention ${index}`,
        body: 'This record must never crowd authorized attention out of the result window.',
        requiresAction: true,
        state: 'active',
        dedupeKey: `uat:listing:revoked:${index}`,
      })),
    })

    await prisma.notification.createMany({
      data: [
        {
          id: 'listing-missing-wedding-scope',
          recipientUserId: E2E_USER.id,
          sourceType: 'planner_task',
          sourceId: `${E2E_WEDDINGS.primary.id}-task`,
          eventType: 'uat.missing-scope',
          category: 'task',
          severity: 'urgent',
          title: 'Malformed wedding source without wedding id',
          body: 'Known wedding-owned sources must fail closed when wedding scope is missing.',
          requiresAction: true,
          state: 'active',
          dedupeKey: 'uat:listing:missing-scope',
        },
        {
          id: 'listing-authorized',
          recipientUserId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.primary.id,
          sourceType: 'planner_task',
          sourceId: `${E2E_WEDDINGS.primary.id}-task`,
          eventType: 'uat.authorized-window',
          category: 'task',
          severity: 'normal',
          title: 'Authorized attention survives the result window',
          body: 'This valid row must remain visible even behind revoked high-priority rows.',
          state: 'active',
          dedupeKey: 'uat:listing:authorized',
        },
        {
          id: 'listing-snooze',
          recipientUserId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.primary.id,
          sourceType: 'planner_task',
          sourceId: `${E2E_WEDDINGS.primary.id}-task`,
          eventType: 'uat.snooze-attention',
          category: 'task',
          severity: 'action_required',
          title: 'Snooze current attention',
          body: 'This action-required row should stop counting as current attention while snoozed.',
          requiresAction: true,
          state: 'active',
          dedupeKey: 'uat:listing:snooze',
        },
        {
          id: 'listing-already-scheduled',
          recipientUserId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.primary.id,
          sourceType: 'planner_task',
          sourceId: `${E2E_WEDDINGS.primary.id}-task`,
          eventType: 'uat.scheduled-attention',
          category: 'task',
          severity: 'urgent',
          title: 'Future scheduled attention',
          body: 'Scheduled future attention must not count as unread current attention.',
          requiresAction: true,
          state: 'scheduled',
          scheduledFor: new Date(Date.now() + 36 * 60 * 60 * 1000),
          dedupeKey: 'uat:listing:scheduled',
        },
      ],
    })

    const before = await page.request.get('/api/notifications?limit=10')
    expect(before.ok()).toBe(true)
    const beforePayload = await before.json()
    const beforeIds = beforePayload.data.map((row: Record<string, unknown>) => row.id)
    expect(beforeIds).toContain('listing-authorized')
    expect(beforeIds).toContain('listing-snooze')
    expect(beforeIds).toContain('listing-already-scheduled')
    expect(beforeIds).not.toContain('listing-missing-wedding-scope')
    expect(beforeIds.some((id: string) => id.startsWith('listing-revoked-'))).toBe(false)
    expect(beforePayload.unreadCount).toBe(2)

    const triggerAt = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString()
    const snooze = await page.request.patch('/api/notifications', {
      data: {
        id: 'listing-snooze',
        action: 'snooze',
        triggerAt,
        timezone: 'UTC',
      },
    })
    expect(snooze.ok()).toBe(true)

    const after = await page.request.get('/api/notifications?limit=10')
    expect(after.ok()).toBe(true)
    const afterPayload = await after.json()
    expect(afterPayload.unreadCount).toBe(1)

    const todayResponse = await page.request.get('/api/today')
    expect(todayResponse.ok()).toBe(true)
    const todayPayload = await todayResponse.json()
    const needsActionIds = todayPayload.data.needsAction.map((row: Record<string, unknown>) => row.id)
    const upcomingIds = todayPayload.data.upcoming.map((row: Record<string, unknown>) => row.id)
    expect(needsActionIds).not.toContain('notification:listing-snooze')
    expect(needsActionIds).not.toContain('notification:listing-already-scheduled')
    expect(upcomingIds).toContain('notification:listing-snooze')
    expect(todayPayload.data.unreadCount).toBe(1)
  } finally {
    await prisma.$disconnect()
  }
})
