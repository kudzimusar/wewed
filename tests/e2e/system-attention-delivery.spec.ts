import { PrismaClient } from '@prisma/client'
import {
  E2E_USER,
  E2E_WEDDINGS,
  expect,
  test,
} from './support/planner-browser'

const CRON_AUTH = 'Bearer wewed-local-ci-cron-secret'

test('notification delivery skips revoked rows, reaches authorized rows and preserves in-app history on channel failure', async ({ plannerPage: page }) => {
  const prisma = new PrismaClient()

  try {
    const unauthorizedCron = await page.request.get('/api/cron/notification-deliveries')
    expect(unauthorizedCron.status()).toBe(401)

    await prisma.weddingMembership.update({
      where: {
        userId_weddingId: {
          userId: E2E_USER.id,
          weddingId: E2E_WEDDINGS.secondary.id,
        },
      },
      data: { status: 'revoked', revokedAt: new Date() },
    })

    await prisma.notificationPreference.create({
      data: {
        id: 'delivery-preference',
        userId: E2E_USER.id,
        scopeKey: 'global',
        inAppEnabled: true,
        pushEnabled: true,
        emailEnabled: true,
        whatsAppEnabled: true,
        timezone: 'UTC',
        digestMode: 'none',
      },
    })

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO wewed_communications."CommunicationEndpoint"
          ("id", "userId", "channel", "address", "normalizedAddress", "status", "verifiedAt", "metadata", "createdAt", "updatedAt")
        VALUES
          ('delivery-email-endpoint', $1, 'EMAIL', 'planner.e2e@example.test', 'planner.e2e@example.test', 'VERIFIED', now(), '{}'::jsonb, now(), now()),
          ('delivery-whatsapp-endpoint', $1, 'WHATSAPP', '+263771234567', '+263771234567', 'VERIFIED', now(), '{}'::jsonb, now(), now())
      `,
      E2E_USER.id,
    )
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO wewed_communications."CommunicationPreference"
          ("id", "userId", "channel", "enabled", "createdAt", "updatedAt")
        VALUES
          ('delivery-email-consent', $1, 'EMAIL', true, now(), now()),
          ('delivery-whatsapp-consent', $1, 'WHATSAPP', true, now(), now())
      `,
      E2E_USER.id,
    )
    await prisma.pushSubscription.create({
      data: {
        id: 'delivery-push-subscription',
        userId: E2E_USER.id,
        endpoint: 'https://push.example.test/subscription/delivery',
        p256dh: 'delivery-p256dh',
        auth: 'delivery-auth',
      },
    })

    await prisma.notification.createMany({
      data: Array.from({ length: 60 }, (_, index) => ({
        id: `delivery-revoked-${index}`,
        recipientUserId: E2E_USER.id,
        weddingId: E2E_WEDDINGS.secondary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.secondary.id}-task`,
        eventType: 'uat.delivery-revoked',
        category: 'task',
        severity: 'urgent',
        title: `Revoked outbound attention ${index}`,
        body: 'This must never consume a deliverable batch slot.',
        requiresAction: true,
        state: 'active',
        dedupeKey: `uat:delivery:revoked:${index}`,
      })),
    })
    await prisma.notification.create({
      data: {
        id: 'delivery-authorized',
        recipientUserId: E2E_USER.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.primary.id}-task`,
        eventType: 'uat.delivery-authorized',
        category: 'task',
        severity: 'normal',
        title: 'Authorized outbound attention',
        body: 'The delivery router must reach this valid notification after revoked rows.',
        requiresAction: true,
        state: 'active',
        dedupeKey: 'uat:delivery:authorized',
      },
    })

    const response = await page.request.get('/api/cron/notification-deliveries', {
      headers: { authorization: CRON_AUTH },
    })
    expect(response.ok()).toBe(true)
    const payload = await response.json()
    expect(payload.success).toBe(true)
    expect(payload.authorizationRejected).toBeGreaterThanOrEqual(60)
    expect(payload.queued).toBe(3)
    expect(payload.processed).toBe(3)
    expect(payload.cancelled).toBeGreaterThanOrEqual(3)
    expect(payload.sent).toBe(0)

    const revokedAttempts = await prisma.notificationDeliveryAttempt.count({
      where: { notificationId: { startsWith: 'delivery-revoked-' } },
    })
    expect(revokedAttempts).toBe(0)

    const attempts = await prisma.notificationDeliveryAttempt.findMany({
      where: { notificationId: 'delivery-authorized' },
      orderBy: { channel: 'asc' },
      select: { channel: true, state: true, errorCode: true },
    })
    expect(attempts).toHaveLength(3)
    expect(attempts.map((attempt) => attempt.channel).sort()).toEqual(['email', 'push', 'whatsapp'])
    for (const attempt of attempts) {
      expect(attempt.state).toBe('cancelled')
      expect(['TRANSPORT_NOT_CONFIGURED', 'NO_ACTIVE_SUBSCRIPTION', 'NO_VERIFIED_ENDPOINT']).toContain(attempt.errorCode)
    }

    const canonical = await prisma.notification.findUniqueOrThrow({
      where: { id: 'delivery-authorized' },
      select: { state: true, readAt: true },
    })
    expect(canonical.state).toBe('active')
    expect(canonical.readAt).toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})
