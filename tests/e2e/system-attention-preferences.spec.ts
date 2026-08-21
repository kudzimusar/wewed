import { PrismaClient } from '@prisma/client'
import { expect, test } from './support/planner-browser'

test('notification preferences expose only valid production semantics and push subscription state', async ({ plannerPage: page }) => {
  const prisma = new PrismaClient()
  try {
    const initialCapabilities = await page.request.get('/api/notifications/capabilities')
    expect(initialCapabilities.ok()).toBe(true)
    const initialCapabilityPayload = await initialCapabilities.json()
    expect(initialCapabilityPayload.success).toBe(true)
    expect(initialCapabilityPayload.data.email.transportConfigured).toBe(false)
    expect(initialCapabilityPayload.data.whatsapp.transportConfigured).toBe(false)
    expect(initialCapabilityPayload.data.push.transportConfigured).toBe(false)
    expect(initialCapabilityPayload.data.push.activeSubscriptionCount).toBe(0)

    for (const invalid of [
      { inAppEnabled: false },
      { digestMode: 'daily' },
      { digestMode: 'weekly' },
      { timezone: 'Definitely/Not-A-Timezone' },
      { quietStart: '22:00' },
      { quietEnd: '07:00' },
      { quietStart: '22:00', quietEnd: '22:00' },
    ]) {
      const response = await page.request.put('/api/notifications/preferences', { data: invalid })
      expect(response.status()).toBe(400)
    }

    const valid = await page.request.put('/api/notifications/preferences', {
      data: {
        scopeKey: 'global',
        inAppEnabled: true,
        pushEnabled: false,
        emailEnabled: false,
        whatsAppEnabled: false,
        timezone: 'Africa/Harare',
        quietStart: '22:00', quietEnd: '07:00',
        digestMode: 'none',
      },
    })
    expect(valid.ok()).toBe(true)
    const validPayload = await valid.json()
    expect(validPayload.data.inAppEnabled).toBe(true)
    expect(validPayload.data.timezone).toBe('Africa/Harare')
    expect(validPayload.data.digestMode).toBe('none')

    const register = await page.request.post('/api/notifications/push-subscriptions', {
      data: {
        endpoint: 'https://push.example.test/subscription/e2e-planner',
        expirationTime: null,
        keys: { p256dh: 'e2e-p256dh-key', auth: 'e2e-auth-key' },
      },
    })
    expect(register.ok()).toBe(true)

    const withSubscription = await page.request.get('/api/notifications/capabilities')
    expect(withSubscription.ok()).toBe(true)
    const withSubscriptionPayload = await withSubscription.json()
    expect(withSubscriptionPayload.data.push.activeSubscriptionCount).toBe(1)
    expect(withSubscriptionPayload.data.push.ready).toBe(false)

    const disable = await page.request.delete('/api/notifications/push-subscriptions', {
      data: { endpoint: 'https://push.example.test/subscription/e2e-planner' },
    })
    expect(disable.ok()).toBe(true)
    const disablePayload = await disable.json()
    expect(disablePayload.disabled).toBe(true)

    expect(await prisma.pushSubscription.count({ where: { disabledAt: null } })).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})

test('planner can discover notification center and every notification page has a deterministic escape', async ({ plannerPage: page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Notifications & communication' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open notifications' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Notification settings' })).toBeVisible()

  await page.goto('/planner')
  await page.getByTestId('planner-adaptive-menu-trigger').click()
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()

  await page.goto('/notifications')
  await expect(page.getByTestId('notification-section-navigation')).toBeVisible()
  await expect(page.getByTestId('notification-exit-workspace')).toHaveAttribute('href', '/planner')
  await expect(page.getByTestId('notification-exit-settings')).toHaveAttribute('href', '/settings')
  await expect(page.getByTestId('notification-open-settings')).toHaveAttribute('href', '/settings/notifications')

  await page.getByTestId('notification-open-settings').click()
  await expect(page).toHaveURL(/\/settings\/notifications$/)
  await expect(page.getByTestId('notification-exit-settings')).toHaveAttribute('href', '/settings')
  await expect(page.getByTestId('notification-open-center')).toHaveAttribute('href', '/notifications')
  await expect(page.getByTestId('notification-exit-workspace')).toHaveAttribute('href', '/planner')

  await page.getByTestId('notification-exit-settings').click()
  await expect(page).toHaveURL(/\/settings$/)

  await page.goto('/settings/notifications/push')
  await expect(page.getByTestId('notification-back-to-settings')).toHaveAttribute('href', '/settings/notifications')
  await expect(page.getByTestId('notification-exit-settings')).toHaveAttribute('href', '/settings')
  await expect(page.getByTestId('notification-exit-workspace')).toHaveAttribute('href', '/planner')

  await page.getByTestId('notification-exit-workspace').click()
  await expect(page).toHaveURL(/\/planner$/)
})
