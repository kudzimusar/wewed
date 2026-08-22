import { PrismaClient } from '@prisma/client'
import { E2E_USER } from './support/planner-fixture'
import { E2E_WEDDINGS, expect, test } from './support/planner-browser'

test('same-account notification state refreshes across devices and Open records read before redirect', async ({ plannerPage: page }) => {
  const prisma = new PrismaClient()

  try {
    await prisma.notification.createMany({
      data: [
        {
          id: 'multidevice-acknowledge',
          recipientUserId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.primary.id,
          sourceType: 'planner_task',
          sourceId: `${E2E_WEDDINGS.primary.id}-task`,
          eventType: 'uat.multidevice-acknowledge',
          category: 'task',
          severity: 'action_required',
          title: 'Cross-device acknowledgement test',
          body: 'Acknowledging this on another device must update this page without looking new again.',
          requiresAction: true,
          state: 'active',
          deepLink: '/planner/tasks',
          dedupeKey: 'uat:multidevice:acknowledge',
        },
        {
          id: 'multidevice-open',
          recipientUserId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.primary.id,
          sourceType: 'planner_task',
          sourceId: `${E2E_WEDDINGS.primary.id}-task`,
          eventType: 'uat.multidevice-open',
          category: 'task',
          severity: 'important',
          title: 'Canonical notification open test',
          body: 'Open must record read state before sending the user to Planner tasks.',
          requiresAction: false,
          state: 'active',
          deepLink: '/planner/tasks',
          dedupeKey: 'uat:multidevice:open',
        },
      ],
    })

    await page.goto('/notifications')
    await expect(page.getByText('Cross-device acknowledgement test')).toBeVisible()
    const ackCard = page.locator('article').filter({ hasText: 'Cross-device acknowledgement test' })
    await expect(ackCard.getByTestId('notification-acknowledged-state')).toHaveCount(0)

    // Simulate the same signed-in account acting from a second device/session against the server.
    const acknowledge = await page.request.patch('/api/notifications', {
      data: { id: 'multidevice-acknowledge', action: 'acknowledge' },
    })
    expect(acknowledge.ok()).toBe(true)

    // The already-open page must revalidate when it becomes active/focused instead of preserving stale state.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(ackCard.getByTestId('notification-acknowledged-state')).toContainText('Acknowledged')
    await page.getByRole('button', { name: 'Needs action' }).click()
    await expect(page.getByText('Cross-device acknowledgement test')).toHaveCount(0)

    const acknowledgedRow = await prisma.notification.findUniqueOrThrow({
      where: { id: 'multidevice-acknowledge' },
      select: { state: true, readAt: true, acknowledgedAt: true },
    })
    expect(acknowledgedRow.state).toBe('acknowledged')
    expect(acknowledgedRow.readAt).not.toBeNull()
    expect(acknowledgedRow.acknowledgedAt).not.toBeNull()

    await page.getByRole('button', { name: 'All' }).click()
    const openCard = page.locator('article').filter({ hasText: 'Canonical notification open test' })
    await openCard.getByTestId('notification-open-source').click()
    await expect(page).toHaveURL(/\/planner\/tasks/)

    const openedRow = await prisma.notification.findUniqueOrThrow({
      where: { id: 'multidevice-open' },
      select: { state: true, readAt: true },
    })
    expect(openedRow.state).toBe('read')
    expect(openedRow.readAt).not.toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})
