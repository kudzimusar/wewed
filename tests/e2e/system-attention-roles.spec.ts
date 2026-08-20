import { createHmac } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import {
  E2E_USER,
  E2E_WEDDINGS,
  resetPlannerE2EFixture,
} from './support/planner-fixture'

const SESSION_COOKIE = 'wewed_admin_auth'
const SESSION_SECRET = process.env.WEWED_SESSION_SECRET ?? ''

interface TestPrincipal {
  id: string
  email: string
  role: 'admin' | 'planner' | 'couple' | 'vendor'
  coupleId: string | null
  activeWeddingId: string
}

const ADMIN: TestPrincipal = {
  id: 'attention-admin-user',
  email: 'attention.admin@example.test',
  role: 'admin',
  coupleId: null,
  activeWeddingId: E2E_WEDDINGS.primary.id,
}

const COUPLE: TestPrincipal = {
  id: 'attention-couple-user',
  email: 'attention.couple@example.test',
  role: 'couple',
  coupleId: E2E_WEDDINGS.primary.coupleId,
  activeWeddingId: E2E_WEDDINGS.primary.id,
}

const VENDOR: TestPrincipal = {
  id: 'attention-vendor-user',
  email: 'attention.vendor@example.test',
  role: 'vendor',
  coupleId: null,
  activeWeddingId: E2E_WEDDINGS.primary.id,
}

const OTHER_VENDOR: TestPrincipal = {
  id: 'attention-other-vendor-user',
  email: 'attention.other.vendor@example.test',
  role: 'vendor',
  coupleId: null,
  activeWeddingId: E2E_WEDDINGS.primary.id,
}

const PLANNER: TestPrincipal = {
  id: E2E_USER.id,
  email: E2E_USER.email,
  role: 'planner',
  coupleId: null,
  activeWeddingId: E2E_WEDDINGS.primary.id,
}

function signedSession(principal: TestPrincipal): string {
  if (!SESSION_SECRET) throw new Error('WEWED_SESSION_SECRET is required for attention role UAT.')
  const payload = {
    version: 2,
    userId: principal.id,
    authUserId: `attention-auth-${principal.id}`,
    email: principal.email,
    role: principal.role,
    coupleId: principal.coupleId,
    activeWeddingId: principal.activeWeddingId,
    expiresAt: Date.now() + 60 * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

async function authenticate(page: Page, principal: TestPrincipal) {
  await page.context().clearCookies()
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: signedSession(principal),
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

async function getJson(page: Page, path: string): Promise<Record<string, any>> {
  const response = await page.request.get(path)
  expect(response.ok(), `${path} should succeed`).toBe(true)
  return response.json()
}

async function patchNotification(page: Page, body: Record<string, unknown>): Promise<Record<string, any>> {
  const response = await page.request.patch('/api/notifications', { data: body })
  expect(response.ok(), `notification action ${String(body.action)} should succeed`).toBe(true)
  return response.json()
}

function todayIds(payload: Record<string, any>): string[] {
  return [
    ...(payload.data?.needsAction ?? []),
    ...(payload.data?.today ?? []),
    ...(payload.data?.upcoming ?? []),
  ].map((item: Record<string, any>) => String(item.id))
}

async function seedAttentionRoleUat(prisma: PrismaClient) {
  const now = Date.now()
  const soon = new Date(now + 6 * 60 * 60 * 1000)
  const grantExpiry = new Date(now + 12 * 60 * 60 * 1000)
  const adminSchedule = new Date(now + 30 * 60 * 1000)

  await prisma.weddingMembership.update({
    where: {
      userId_weddingId: {
        userId: E2E_USER.id,
        weddingId: E2E_WEDDINGS.secondary.id,
      },
    },
    data: { status: 'revoked', revokedAt: new Date() },
  })

  await prisma.user.createMany({
    data: [
      { id: ADMIN.id, email: ADMIN.email, name: 'Attention Admin', role: ADMIN.role },
      {
        id: COUPLE.id,
        email: COUPLE.email,
        name: 'Attention Couple',
        role: COUPLE.role,
        coupleId: COUPLE.coupleId,
        currentWeddingId: COUPLE.activeWeddingId,
      },
      { id: VENDOR.id, email: VENDOR.email, name: 'Attention Vendor', role: VENDOR.role },
      {
        id: OTHER_VENDOR.id,
        email: OTHER_VENDOR.email,
        name: 'Other Attention Vendor',
        role: OTHER_VENDOR.role,
      },
    ],
  })

  await prisma.couple.update({
    where: { id: E2E_WEDDINGS.primary.coupleId },
    data: { userId: COUPLE.id },
  })

  await prisma.weddingMembership.create({
    data: {
      id: 'attention-couple-membership',
      userId: COUPLE.id,
      weddingId: E2E_WEDDINGS.primary.id,
      role: 'owner',
      status: 'active',
      acceptedAt: new Date(),
    },
  })

  await prisma.vendor.create({
    data: {
      id: 'attention-other-vendor',
      name: 'Other Attention Florist',
      category: 'florist',
      weddingId: E2E_WEDDINGS.primary.id,
    },
  })

  await prisma.serviceEngagement.createMany({
    data: [
      {
        id: 'attention-engagement-own',
        origin: 'current',
        recordMode: 'managed_contract',
        lifecycleStatus: 'active',
        serviceCategory: 'Venue',
        serviceDescription: 'Own vendor service',
        serviceDate: soon,
        serviceLocation: 'Primary Test Estate',
        weddingId: E2E_WEDDINGS.primary.id,
        vendorId: `${E2E_WEDDINGS.primary.id}-vendor`,
      },
      {
        id: 'attention-engagement-other',
        origin: 'current',
        recordMode: 'managed_contract',
        lifecycleStatus: 'active',
        serviceCategory: 'Florist',
        serviceDescription: 'Other vendor service',
        serviceDate: soon,
        serviceLocation: 'Primary Test Estate',
        weddingId: E2E_WEDDINGS.primary.id,
        vendorId: 'attention-other-vendor',
      },
    ],
  })

  await prisma.engagementParty.createMany({
    data: [
      {
        id: 'attention-party-own',
        serviceEngagementId: 'attention-engagement-own',
        weddingId: E2E_WEDDINGS.primary.id,
        partyRole: 'SERVICE_PROVIDER',
        partyKind: 'VENDOR',
        displayName: 'Attention Vendor',
        userId: VENDOR.id,
      },
      {
        id: 'attention-party-other',
        serviceEngagementId: 'attention-engagement-other',
        weddingId: E2E_WEDDINGS.primary.id,
        partyRole: 'SERVICE_PROVIDER',
        partyKind: 'VENDOR',
        displayName: 'Other Attention Vendor',
        userId: OTHER_VENDOR.id,
      },
      {
        id: 'attention-party-representative',
        serviceEngagementId: 'attention-engagement-own',
        weddingId: E2E_WEDDINGS.primary.id,
        partyRole: 'AUTHORIZED_REPRESENTATIVE',
        partyKind: 'PERSON',
        displayName: 'Non-provider representative',
        userId: OTHER_VENDOR.id,
      },
    ],
  })

  await prisma.contractTemplate.create({
    data: {
      id: 'attention-contract-template',
      code: 'ATTENTION_UAT_VENDOR',
      title: 'Attention UAT Vendor Agreement',
      serviceCategory: 'General',
      semanticVersion: '1.0.0',
      templateHash: 'a'.repeat(64),
    },
  })

  await prisma.contract.createMany({
    data: [
      {
        id: 'attention-contract-own',
        contractNumber: 'WW-ATTN-OWN',
        serviceEngagementId: 'attention-engagement-own',
        weddingId: E2E_WEDDINGS.primary.id,
        templateId: 'attention-contract-template',
        status: 'ISSUED',
        currentVersionNumber: 1,
        title: 'Own vendor agreement',
      },
      {
        id: 'attention-contract-other',
        contractNumber: 'WW-ATTN-OTHER',
        serviceEngagementId: 'attention-engagement-other',
        weddingId: E2E_WEDDINGS.primary.id,
        templateId: 'attention-contract-template',
        status: 'ISSUED',
        currentVersionNumber: 1,
        title: 'Other vendor agreement',
      },
    ],
  })

  await prisma.contractVersion.createMany({
    data: [
      {
        id: 'attention-version-own',
        contractId: 'attention-contract-own',
        weddingId: E2E_WEDDINGS.primary.id,
        versionNumber: 1,
        status: 'ISSUED',
        templateSemanticVersion: '1.0.0',
        canonicalJson: '{}',
        renderedHtml: '<p>Own vendor agreement</p>',
      },
      {
        id: 'attention-version-other',
        contractId: 'attention-contract-other',
        weddingId: E2E_WEDDINGS.primary.id,
        versionNumber: 1,
        status: 'ISSUED',
        templateSemanticVersion: '1.0.0',
        canonicalJson: '{}',
        renderedHtml: '<p>Other vendor agreement</p>',
      },
    ],
  })

  await prisma.contractReviewGrant.createMany({
    data: [
      {
        id: 'attention-grant-own',
        contractId: 'attention-contract-own',
        contractVersionId: 'attention-version-own',
        engagementPartyId: 'attention-party-own',
        role: 'SERVICE_PROVIDER',
        tokenHash: 'b'.repeat(64),
        status: 'ACTIVE',
        expiresAt: grantExpiry,
      },
      {
        id: 'attention-grant-other',
        contractId: 'attention-contract-other',
        contractVersionId: 'attention-version-other',
        engagementPartyId: 'attention-party-other',
        role: 'SERVICE_PROVIDER',
        tokenHash: 'c'.repeat(64),
        status: 'ACTIVE',
        expiresAt: grantExpiry,
      },
    ],
  })

  const commonNotification = {
    eventType: 'uat.attention',
    severity: 'action_required',
    body: 'Deterministic attention role UAT record.',
    requiresAction: true,
    state: 'active',
  }

  await prisma.notification.createMany({
    data: [
      {
        id: 'uat-admin-global',
        recipientUserId: ADMIN.id,
        sourceType: 'admin_operation',
        sourceId: 'attention-admin-operation',
        category: 'admin',
        title: 'Admin operational attention',
        scheduledFor: adminSchedule,
        deepLink: '/admin',
        dedupeKey: 'uat:admin:global',
        ...commonNotification,
      },
      {
        id: 'uat-admin-private',
        recipientUserId: ADMIN.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.primary.id}-task`,
        category: 'admin',
        title: 'Private wedding data must not reach Admin attention',
        scheduledFor: adminSchedule,
        deepLink: '/planner/tasks',
        dedupeKey: 'uat:admin:private',
        ...commonNotification,
      },
      {
        id: 'uat-planner-own',
        recipientUserId: PLANNER.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.primary.id}-task`,
        category: 'task',
        title: 'Planner own wedding task',
        deepLink: '/planner/tasks',
        dedupeKey: 'uat:planner:own',
        ...commonNotification,
      },
      {
        id: 'uat-planner-secondary',
        recipientUserId: PLANNER.id,
        weddingId: E2E_WEDDINGS.secondary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.secondary.id}-task`,
        category: 'task',
        title: 'Revoked planner wedding task',
        deepLink: '/planner/tasks',
        dedupeKey: 'uat:planner:revoked',
        ...commonNotification,
      },
      {
        id: 'uat-planner-ack',
        recipientUserId: PLANNER.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.primary.id}-task`,
        category: 'task',
        title: 'Planner acknowledge lifecycle',
        dedupeKey: 'uat:planner:ack',
        ...commonNotification,
      },
      {
        id: 'uat-planner-resolve',
        recipientUserId: PLANNER.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.primary.id}-task`,
        category: 'task',
        title: 'Planner resolve lifecycle',
        dedupeKey: 'uat:planner:resolve',
        ...commonNotification,
      },
      {
        id: 'uat-planner-snooze',
        recipientUserId: PLANNER.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.primary.id}-task`,
        category: 'task',
        title: 'Planner snooze lifecycle',
        dedupeKey: 'uat:planner:snooze',
        ...commonNotification,
      },
      {
        id: 'uat-couple-own',
        recipientUserId: COUPLE.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'planner_task',
        sourceId: `${E2E_WEDDINGS.primary.id}-task`,
        category: 'task',
        title: 'Couple own wedding task',
        deepLink: '/planner/tasks',
        dedupeKey: 'uat:couple:own',
        ...commonNotification,
      },
      {
        id: 'uat-couple-admin-malformed',
        recipientUserId: COUPLE.id,
        sourceType: 'admin_operation',
        sourceId: 'attention-admin-operation',
        category: 'admin',
        title: 'Admin operation must not reach Couple',
        dedupeKey: 'uat:couple:admin-malformed',
        ...commonNotification,
      },
      {
        id: 'uat-vendor-engagement-own',
        recipientUserId: VENDOR.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'service_engagement',
        sourceId: 'attention-engagement-own',
        category: 'engagement',
        title: 'Vendor own engagement',
        deepLink: '/vendor',
        dedupeKey: 'uat:vendor:engagement:own',
        ...commonNotification,
      },
      {
        id: 'uat-vendor-engagement-other',
        recipientUserId: VENDOR.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'service_engagement',
        sourceId: 'attention-engagement-other',
        category: 'engagement',
        title: 'Other vendor engagement must not leak',
        deepLink: '/vendor',
        dedupeKey: 'uat:vendor:engagement:other',
        ...commonNotification,
      },
      {
        id: 'uat-vendor-contract-own',
        recipientUserId: VENDOR.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'contract_review_grant',
        sourceId: 'attention-grant-own',
        category: 'contract',
        title: 'Vendor own contract review grant',
        deepLink: '/vendor',
        dedupeKey: 'uat:vendor:grant:own',
        ...commonNotification,
      },
      {
        id: 'uat-vendor-contract-other',
        recipientUserId: VENDOR.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'contract_review_grant',
        sourceId: 'attention-grant-other',
        category: 'contract',
        title: 'Other vendor contract review grant must not leak',
        deepLink: '/vendor',
        dedupeKey: 'uat:vendor:grant:other',
        ...commonNotification,
      },
      {
        id: 'uat-vendor-budget',
        recipientUserId: VENDOR.id,
        weddingId: E2E_WEDDINGS.primary.id,
        sourceType: 'budget_item',
        sourceId: `${E2E_WEDDINGS.primary.id}-budget`,
        category: 'budget',
        title: 'Wedding budget must not leak to Vendor',
        deepLink: '/vendor',
        dedupeKey: 'uat:vendor:budget',
        ...commonNotification,
      },
    ],
  })
}

test('system attention role UAT: Admin, Planner, Couple and Vendor remain source-isolated', async ({ page }) => {
  await resetPlannerE2EFixture()
  const prisma = new PrismaClient()

  try {
    await seedAttentionRoleUat(prisma)

    const from = encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    const to = encodeURIComponent(new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString())

    await authenticate(page, ADMIN)
    const adminNotifications = await getJson(page, '/api/notifications?limit=100')
    const adminNotificationIds = adminNotifications.data.map((row: Record<string, any>) => row.id)
    expect(adminNotificationIds).toContain('uat-admin-global')
    expect(adminNotificationIds).not.toContain('uat-admin-private')

    const adminCalendar = await getJson(page, `/api/calendar?from=${from}&to=${to}&limit=1000`)
    const adminCalendarNotificationIds = adminCalendar.data
      .map((row: Record<string, any>) => row.metadata?.notificationId)
      .filter(Boolean)
    expect(adminCalendarNotificationIds).toContain('uat-admin-global')
    expect(adminCalendarNotificationIds).not.toContain('uat-admin-private')

    const adminToday = await getJson(page, '/api/today')
    expect(todayIds(adminToday)).toContain('notification:uat-admin-global')
    expect(todayIds(adminToday)).not.toContain('notification:uat-admin-private')

    await authenticate(page, PLANNER)
    const plannerNotifications = await getJson(page, '/api/notifications?limit=100')
    const plannerNotificationIds = plannerNotifications.data.map((row: Record<string, any>) => row.id)
    expect(plannerNotificationIds).toContain('uat-planner-own')
    expect(plannerNotificationIds).not.toContain('uat-planner-secondary')

    const plannerCalendar = await getJson(page, `/api/calendar?from=${from}&to=${to}&limit=1000`)
    const plannerCalendarIds = plannerCalendar.data.map((row: Record<string, any>) => row.id)
    expect(plannerCalendarIds).toContain(`task:${E2E_WEDDINGS.primary.id}-task:due`)
    expect(plannerCalendarIds).not.toContain(`task:${E2E_WEDDINGS.secondary.id}-task:due`)

    const plannerToday = await getJson(page, '/api/today')
    expect(todayIds(plannerToday)).toContain('notification:uat-planner-own')
    expect(todayIds(plannerToday)).not.toContain('notification:uat-planner-secondary')

    await authenticate(page, COUPLE)
    const coupleNotifications = await getJson(page, '/api/notifications?limit=100')
    const coupleNotificationIds = coupleNotifications.data.map((row: Record<string, any>) => row.id)
    expect(coupleNotificationIds).toContain('uat-couple-own')
    expect(coupleNotificationIds).not.toContain('uat-couple-admin-malformed')

    const coupleCalendar = await getJson(page, `/api/calendar?from=${from}&to=${to}&limit=1000`)
    const coupleCalendarIds = coupleCalendar.data.map((row: Record<string, any>) => row.id)
    expect(coupleCalendarIds).toContain(`task:${E2E_WEDDINGS.primary.id}-task:due`)
    expect(coupleCalendarIds).not.toContain(`task:${E2E_WEDDINGS.secondary.id}-task:due`)

    const coupleToday = await getJson(page, '/api/today')
    expect(todayIds(coupleToday)).toContain('notification:uat-couple-own')
    expect(todayIds(coupleToday)).not.toContain('notification:uat-couple-admin-malformed')

    await authenticate(page, VENDOR)
    const vendorNotifications = await getJson(page, '/api/notifications?limit=100')
    const vendorNotificationIds = vendorNotifications.data.map((row: Record<string, any>) => row.id)
    expect(vendorNotificationIds).toContain('uat-vendor-engagement-own')
    expect(vendorNotificationIds).toContain('uat-vendor-contract-own')
    expect(vendorNotificationIds).not.toContain('uat-vendor-engagement-other')
    expect(vendorNotificationIds).not.toContain('uat-vendor-contract-other')
    expect(vendorNotificationIds).not.toContain('uat-vendor-budget')

    const vendorCalendar = await getJson(page, `/api/calendar?from=${from}&to=${to}&limit=1000`)
    const vendorCalendarIds = vendorCalendar.data.map((row: Record<string, any>) => row.id)
    expect(vendorCalendarIds).toContain('engagement:attention-engagement-own:service')
    expect(vendorCalendarIds).toContain('contract-review-grant:attention-grant-own:expires')
    expect(vendorCalendarIds).not.toContain('engagement:attention-engagement-other:service')
    expect(vendorCalendarIds).not.toContain('contract-review-grant:attention-grant-other:expires')
    expect(vendorCalendar.data.some((row: Record<string, any>) => row.category === 'budget')).toBe(false)

    const vendorToday = await getJson(page, '/api/today')
    const vendorTodayIds = todayIds(vendorToday)
    expect(vendorTodayIds).toContain('notification:uat-vendor-engagement-own')
    expect(vendorTodayIds).toContain('notification:uat-vendor-contract-own')
    expect(vendorTodayIds).not.toContain('notification:uat-vendor-engagement-other')
    expect(vendorTodayIds).not.toContain('notification:uat-vendor-contract-other')
    expect(vendorTodayIds).not.toContain('notification:uat-vendor-budget')

    // Notification state is per-recipient, and lifecycle actions never mutate the source task date.
    const taskBefore = await prisma.plannerTask.findUniqueOrThrow({
      where: { id: `${E2E_WEDDINGS.primary.id}-task` },
      select: { dueDate: true },
    })

    await authenticate(page, PLANNER)
    const readResult = await patchNotification(page, { id: 'uat-planner-own', action: 'read' })
    expect(readResult.data.state).toBe('read')
    expect(readResult.data.readAt).toBeTruthy()

    const acknowledgeResult = await patchNotification(page, {
      id: 'uat-planner-ack',
      action: 'acknowledge',
    })
    expect(acknowledgeResult.data.state).toBe('acknowledged')
    expect(acknowledgeResult.data.acknowledgedAt).toBeTruthy()

    const resolveResult = await patchNotification(page, {
      id: 'uat-planner-resolve',
      action: 'resolve',
    })
    expect(resolveResult.data.state).toBe('resolved')
    expect(resolveResult.data.resolvedAt).toBeTruthy()

    const triggerAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    const snoozeResult = await patchNotification(page, {
      id: 'uat-planner-snooze',
      action: 'snooze',
      triggerAt,
      timezone: 'UTC',
    })
    expect(snoozeResult.data.notification.state).toBe('scheduled')
    expect(snoozeResult.data.notification.snoozedUntil).toBe(triggerAt)
    expect(snoozeResult.data.reminder.state).toBe('scheduled')

    const taskAfter = await prisma.plannerTask.findUniqueOrThrow({
      where: { id: `${E2E_WEDDINGS.primary.id}-task` },
      select: { dueDate: true },
    })
    expect(taskAfter.dueDate?.toISOString()).toBe(taskBefore.dueDate?.toISOString())

    await authenticate(page, COUPLE)
    const coupleAfterPlannerRead = await getJson(page, '/api/notifications?limit=100')
    const coupleOwn = coupleAfterPlannerRead.data.find(
      (row: Record<string, any>) => row.id === 'uat-couple-own',
    )
    expect(coupleOwn?.state).toBe('active')
    expect(coupleOwn?.readAt).toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})
