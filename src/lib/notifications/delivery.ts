import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email/resend'
import { buildWhatsAppRequest } from '@/lib/communication-channels'
import {
  isNotificationExternallyDeliverableToRecipient,
  type DeliveryAuthorizationCandidate,
} from '@/lib/notifications/delivery-authorization'
import {
  notificationExternalDeliveryDecision,
  notificationRetryDelayMs,
  type NotificationExternalChannel,
} from '@/lib/notifications/delivery-policy'

const MAX_ATTEMPTS_PER_CHANNEL = 5
const NOTIFICATION_DELIVERY_LOOKBACK_HOURS = 24

interface NotificationDeliveryCandidate extends DeliveryAuthorizationCandidate {
  title: string
  body: string
  deepLink: string | null
  state: string
  readAt: Date | null
  scheduledFor: Date | null
  snoozedUntil: Date | null
  expiresAt: Date | null
  createdAt: Date
  emailEnabled: boolean
  whatsAppEnabled: boolean
  pushEnabled: boolean
  timezone: string
  quietStart: string | null
  quietEnd: string | null
  digestMode: 'none' | 'daily' | 'weekly'
}

interface AttemptRow {
  id: string
  notificationId: string
  channel: NotificationExternalChannel
  state: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled'
  providerRef: string | null
  errorCode: string | null
  errorMessage: string | null
  attemptedAt: Date | null
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface CommunicationEndpointRow {
  id: string
  address: string
  normalizedAddress: string
}

interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  expirationTime: bigint | null
}

interface TransportResult {
  ok: boolean
  provider: string
  providerRef?: string
  errorCode?: string
  errorMessage?: string
  unavailable?: boolean
  retriable?: boolean
}

export interface NotificationDeliveryStats {
  locked: boolean
  candidates: number
  authorizationRejected: number
  queued: number
  processed: number
  sent: number
  failed: number
  cancelled: number
  deferred: number
}

function applicationBaseUrl(): string {
  return (process.env.WEWED_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://wewed.pro').replace(/\/$/, '')
}

function safeNotificationLink(deepLink: string | null): string {
  const path = deepLink && deepLink.startsWith('/') && !deepLink.startsWith('//')
    ? deepLink
    : '/notifications'
  return `${applicationBaseUrl()}${path}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function communicationEndpoint(
  userId: string,
  channel: 'EMAIL' | 'WHATSAPP',
): Promise<CommunicationEndpointRow | null> {
  const rows = await db.$queryRawUnsafe<CommunicationEndpointRow[]>(
    `
      SELECT endpoint.id, endpoint.address, endpoint."normalizedAddress"
      FROM wewed_communications."CommunicationEndpoint" endpoint
      JOIN wewed_communications."CommunicationPreference" preference
        ON preference."userId" = endpoint."userId"
       AND preference.channel = endpoint.channel
      WHERE endpoint."userId" = $1
        AND endpoint.channel = $2
        AND endpoint.status = 'VERIFIED'
        AND preference.enabled = true
      ORDER BY endpoint."verifiedAt" DESC NULLS LAST, endpoint."createdAt" DESC
      LIMIT 1
    `,
    userId,
    channel,
  )
  return rows[0] ?? null
}

async function activePushSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  return db.$queryRawUnsafe<PushSubscriptionRow[]>(
    `
      SELECT id, endpoint, p256dh, auth, "expirationTime"
      FROM public."PushSubscription"
      WHERE "userId" = $1
        AND "disabledAt" IS NULL
        AND ("expirationTime" IS NULL OR "expirationTime" > $2)
      ORDER BY "lastSeenAt" DESC
    `,
    userId,
    BigInt(Date.now()),
  )
}

async function notificationCandidates(): Promise<NotificationDeliveryCandidate[]> {
  return db.$queryRawUnsafe<NotificationDeliveryCandidate[]>(
    `
      SELECT n.id, n."recipientUserId", recipient.role AS "recipientRole",
             n."weddingId", n.category, n."sourceType", n."sourceId",
             n.title, n.body, n."deepLink", n.state,
             n."readAt", n."scheduledFor", n."snoozedUntil", n."expiresAt", n."createdAt",
             preference."emailEnabled", preference."whatsAppEnabled", preference."pushEnabled",
             preference.timezone, preference."quietStart", preference."quietEnd", preference."digestMode"
      FROM public."Notification" n
      JOIN public."User" recipient ON recipient.id = n."recipientUserId"
      JOIN public."NotificationPreference" preference
        ON preference."userId" = n."recipientUserId" AND preference."scopeKey" = 'global'
      WHERE n.state IN ('active', 'queued')
        AND n."readAt" IS NULL
        AND n."createdAt" >= CURRENT_TIMESTAMP - ($1::text || ' hours')::interval
        AND (n."expiresAt" IS NULL OR n."expiresAt" > CURRENT_TIMESTAMP)
        AND (
          preference."emailEnabled" = true
          OR preference."whatsAppEnabled" = true
          OR preference."pushEnabled" = true
        )
      ORDER BY
        CASE n.severity
          WHEN 'urgent' THEN 0
          WHEN 'action_required' THEN 1
          WHEN 'important' THEN 2
          ELSE 3
        END,
        n."createdAt" ASC
    `,
    NOTIFICATION_DELIVERY_LOOKBACK_HOURS,
  )
}

async function attemptHistory(notificationId: string, channel: NotificationExternalChannel): Promise<AttemptRow[]> {
  return db.$queryRawUnsafe<AttemptRow[]>(
    `
      SELECT *
      FROM public."NotificationDeliveryAttempt"
      WHERE "notificationId" = $1 AND channel = $2
      ORDER BY "createdAt" DESC
      LIMIT $3
    `,
    notificationId,
    channel,
    MAX_ATTEMPTS_PER_CHANNEL + 2,
  )
}

function mayQueueAttempt(history: AttemptRow[], now: Date): boolean {
  if (history.some((attempt) => ['queued', 'sent', 'delivered', 'read', 'cancelled'].includes(attempt.state))) {
    return false
  }
  if (history.length >= MAX_ATTEMPTS_PER_CHANNEL) return false
  const latest = history[0]
  if (!latest) return true
  const retryAt = latest.createdAt.getTime() + notificationRetryDelayMs(history.length)
  return retryAt <= now.getTime()
}

async function insertAttempt(notificationId: string, channel: NotificationExternalChannel): Promise<boolean> {
  const id = randomUUID()
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO public."NotificationDeliveryAttempt" (
        id, "notificationId", channel, state, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, 'queued', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `,
    id,
    notificationId,
    channel,
  )
  return Boolean(rows[0])
}

async function cancelAttempt(attemptId: string, code: string, message: string | null = null) {
  await db.$executeRawUnsafe(
    `
      UPDATE public."NotificationDeliveryAttempt"
      SET state = 'cancelled', "errorCode" = $2, "errorMessage" = $3, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND state = 'queued'
    `,
    attemptId,
    code,
    message,
  )
}

async function sendEmail(
  attempt: AttemptRow,
  notification: NotificationDeliveryCandidate,
  endpoint: CommunicationEndpointRow,
): Promise<TransportResult> {
  const link = safeNotificationLink(notification.deepLink)
  const result = await sendTransactionalEmail({
    idempotencyKey: `notification:${attempt.id}`,
    category: 'notifications',
    to: endpoint.normalizedAddress,
    subject: notification.title,
    text: `${notification.title}\n\n${notification.body}\n\nOpen Wewed: ${link}`,
    html: `<p><strong>${escapeHtml(notification.title)}</strong></p><p>${escapeHtml(notification.body).replaceAll('\n', '<br>')}</p><p><a href="${escapeHtml(link)}">Open Wewed</a></p>`,
    metadata: {
      notificationId: notification.id,
      notificationDeliveryAttemptId: attempt.id,
    },
    tags: [{ name: 'notification_delivery_attempt_id', value: attempt.id }],
  })
  if (result.ok) {
    return {
      ok: true,
      provider: 'resend',
      providerRef: result.providerEmailId,
    }
  }
  if (result.reason === 'not_configured') {
    return {
      ok: false,
      provider: 'resend',
      unavailable: true,
      errorCode: 'TRANSPORT_NOT_CONFIGURED',
    }
  }
  return {
    ok: false,
    provider: 'resend',
    retriable: true,
    errorCode: 'PROVIDER_ERROR',
  }
}

async function sendWhatsApp(
  attempt: AttemptRow,
  notification: NotificationDeliveryCandidate,
  endpoint: CommunicationEndpointRow,
): Promise<TransportResult> {
  const link = safeNotificationLink(notification.deepLink)
  const text = `${notification.title}\n\n${notification.body}\n\nOpen Wewed: ${link}`.slice(0, 4000)
  const request = buildWhatsAppRequest({
    id: attempt.id,
    messageId: notification.id,
    recipientUserId: notification.recipientUserId,
    channel: 'WHATSAPP',
    attemptCount: 1,
    maxAttempts: MAX_ATTEMPTS_PER_CHANNEL,
    address: endpoint.address,
    normalizedAddress: endpoint.normalizedAddress,
    body: text,
    conversationId: notification.id,
    senderName: 'Wewed',
    // System notifications conservatively use an approved template outside a proven service window.
    whatsappServiceWindowActive: false,
  })
  if (!request) {
    return {
      ok: false,
      provider: 'meta-whatsapp-cloud',
      unavailable: true,
      errorCode: 'TRANSPORT_NOT_CONFIGURED',
    }
  }
  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(10_000),
    })
    const payload = await response.json().catch(() => null) as unknown
    if (!response.ok) {
      return {
        ok: false,
        provider: 'meta-whatsapp-cloud',
        retriable: [408, 409, 425, 429].includes(response.status) || response.status >= 500,
        errorCode: `HTTP_${response.status}`,
      }
    }
    let providerRef: string | undefined
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const messages = (payload as Record<string, unknown>).messages
      if (Array.isArray(messages) && messages[0] && typeof messages[0] === 'object') {
        const id = (messages[0] as Record<string, unknown>).id
        if (typeof id === 'string') providerRef = id
      }
    }
    return { ok: true, provider: 'meta-whatsapp-cloud', providerRef }
  } catch {
    return {
      ok: false,
      provider: 'meta-whatsapp-cloud',
      retriable: true,
      errorCode: 'NETWORK_ERROR',
    }
  }
}

async function sendPush(
  attempt: AttemptRow,
  notification: NotificationDeliveryCandidate,
  subscriptions: PushSubscriptionRow[],
): Promise<TransportResult> {
  const gatewayUrl = process.env.WEWED_PUSH_GATEWAY_URL?.trim()
  if (!gatewayUrl) {
    return {
      ok: false,
      provider: 'push-gateway',
      unavailable: true,
      errorCode: 'TRANSPORT_NOT_CONFIGURED',
    }
  }
  const gatewayToken = process.env.WEWED_PUSH_GATEWAY_TOKEN?.trim()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (gatewayToken) headers.Authorization = `Bearer ${gatewayToken}`
  const link = safeNotificationLink(notification.deepLink)
  let sent = 0
  let retriableFailure = false
  const providerRefs: string[] = []

  for (const subscription of subscriptions) {
    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime ? Number(subscription.expirationTime) : null,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          notification: {
            title: notification.title,
            body: notification.body.slice(0, 240),
            url: link,
            tag: `wewed-notification-${notification.id}`,
          },
          notificationId: notification.id,
          deliveryAttemptId: attempt.id,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      const payload = await response.json().catch(() => null) as unknown
      if (response.ok) {
        sent += 1
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const id = (payload as Record<string, unknown>).id
          if (typeof id === 'string') providerRefs.push(id)
        }
        continue
      }
      if (response.status === 404 || response.status === 410) {
        await db.$executeRawUnsafe(
          `UPDATE public."PushSubscription" SET "disabledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
          subscription.id,
        )
        continue
      }
      if ([408, 409, 425, 429].includes(response.status) || response.status >= 500) {
        retriableFailure = true
      }
    } catch {
      retriableFailure = true
    }
  }

  if (sent > 0) {
    return {
      ok: true,
      provider: 'push-gateway',
      providerRef: providerRefs.length ? providerRefs.slice(0, 5).join(',') : undefined,
    }
  }
  return {
    ok: false,
    provider: 'push-gateway',
    retriable: retriableFailure,
    errorCode: retriableFailure ? 'GATEWAY_RETRYABLE_ERROR' : 'NO_ACTIVE_SUBSCRIPTION',
  }
}

async function finishAttempt(attempt: AttemptRow, result: TransportResult): Promise<'sent' | 'failed' | 'cancelled'> {
  if (result.ok) {
    await db.$executeRawUnsafe(
      `
        UPDATE public."NotificationDeliveryAttempt"
        SET state = 'sent', "providerRef" = $2, "errorCode" = NULL, "errorMessage" = NULL,
            "sentAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND state = 'queued'
      `,
      attempt.id,
      result.providerRef ? `${result.provider}:${result.providerRef}` : result.provider,
    )
    return 'sent'
  }
  if (result.unavailable || result.retriable !== true) {
    await db.$executeRawUnsafe(
      `
        UPDATE public."NotificationDeliveryAttempt"
        SET state = 'cancelled', "providerRef" = $2, "errorCode" = $3, "errorMessage" = $4,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND state = 'queued'
      `,
      attempt.id,
      result.provider,
      result.errorCode ?? 'DELIVERY_UNAVAILABLE',
      result.errorMessage ?? null,
    )
    return 'cancelled'
  }
  await db.$executeRawUnsafe(
    `
      UPDATE public."NotificationDeliveryAttempt"
      SET state = 'failed', "providerRef" = $2, "errorCode" = $3, "errorMessage" = $4,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND state = 'queued'
    `,
    attempt.id,
    result.provider,
    result.errorCode ?? 'PROVIDER_ERROR',
    result.errorMessage ?? null,
  )
  return 'failed'
}

async function processQueuedAttempts(limit: number, stats: NotificationDeliveryStats) {
  const attempts = await db.$queryRawUnsafe<AttemptRow[]>(
    `
      SELECT * FROM public."NotificationDeliveryAttempt"
      WHERE state = 'queued'
      ORDER BY "createdAt" ASC
      LIMIT $1
    `,
    limit,
  )

  for (const attempt of attempts) {
    const rows = await db.$queryRawUnsafe<NotificationDeliveryCandidate[]>(
      `
        SELECT n.id, n."recipientUserId", recipient.role AS "recipientRole",
               n."weddingId", n.category, n."sourceType", n."sourceId",
               n.title, n.body, n."deepLink", n.state,
               n."readAt", n."scheduledFor", n."snoozedUntil", n."expiresAt", n."createdAt",
               COALESCE(preference."emailEnabled", false) AS "emailEnabled",
               COALESCE(preference."whatsAppEnabled", false) AS "whatsAppEnabled",
               COALESCE(preference."pushEnabled", false) AS "pushEnabled",
               COALESCE(preference.timezone, 'UTC') AS timezone,
               preference."quietStart", preference."quietEnd", COALESCE(preference."digestMode", 'none') AS "digestMode"
        FROM public."Notification" n
        JOIN public."User" recipient ON recipient.id = n."recipientUserId"
        LEFT JOIN public."NotificationPreference" preference
          ON preference."userId" = n."recipientUserId" AND preference."scopeKey" = 'global'
        WHERE n.id = $1
        LIMIT 1
      `,
      attempt.notificationId,
    )
    const notification = rows[0]
    if (!notification) {
      await cancelAttempt(attempt.id, 'NOTIFICATION_MISSING')
      stats.cancelled += 1
      continue
    }

    if (!(await isNotificationExternallyDeliverableToRecipient(notification))) {
      await cancelAttempt(attempt.id, 'AUTHORIZATION_REVOKED')
      stats.authorizationRejected += 1
      stats.cancelled += 1
      continue
    }

    const enabled = attempt.channel === 'email'
      ? notification.emailEnabled
      : attempt.channel === 'whatsapp'
        ? notification.whatsAppEnabled
        : notification.pushEnabled
    const policy = notificationExternalDeliveryDecision({
      channel: attempt.channel,
      channelEnabled: enabled,
      digestMode: notification.digestMode,
      timezone: notification.timezone,
      quietStart: notification.quietStart,
      quietEnd: notification.quietEnd,
      now: new Date(),
      state: notification.state,
      readAt: notification.readAt,
      scheduledFor: notification.scheduledFor,
      snoozedUntil: notification.snoozedUntil,
      expiresAt: notification.expiresAt,
    })
    if (!policy.eligible) {
      await cancelAttempt(attempt.id, `POLICY_${policy.reason.toUpperCase()}`)
      stats.cancelled += 1
      continue
    }

    await db.$executeRawUnsafe(
      `UPDATE public."NotificationDeliveryAttempt" SET "attemptedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 AND state = 'queued'`,
      attempt.id,
    )

    let result: TransportResult
    if (attempt.channel === 'email') {
      const endpoint = await communicationEndpoint(notification.recipientUserId, 'EMAIL')
      result = endpoint
        ? await sendEmail(attempt, notification, endpoint)
        : { ok: false, provider: 'resend', unavailable: true, errorCode: 'NO_VERIFIED_ENDPOINT' }
    } else if (attempt.channel === 'whatsapp') {
      const endpoint = await communicationEndpoint(notification.recipientUserId, 'WHATSAPP')
      result = endpoint
        ? await sendWhatsApp(attempt, notification, endpoint)
        : { ok: false, provider: 'meta-whatsapp-cloud', unavailable: true, errorCode: 'NO_VERIFIED_ENDPOINT' }
    } else {
      const subscriptions = await activePushSubscriptions(notification.recipientUserId)
      result = subscriptions.length
        ? await sendPush(attempt, notification, subscriptions)
        : { ok: false, provider: 'push-gateway', unavailable: true, errorCode: 'NO_ACTIVE_SUBSCRIPTION' }
    }

    const finalState = await finishAttempt(attempt, result)
    stats.processed += 1
    if (finalState === 'sent') stats.sent += 1
    else if (finalState === 'failed') stats.failed += 1
    else stats.cancelled += 1
  }
}

export async function runNotificationDeliveryRouter(
  now = new Date(),
  limit = 50,
): Promise<NotificationDeliveryStats> {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)))
  const stats: NotificationDeliveryStats = {
    locked: false,
    candidates: 0,
    authorizationRejected: 0,
    queued: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    deferred: 0,
  }

  const lock = await db.$queryRawUnsafe<Array<{ acquired: boolean }>>(
    `SELECT pg_try_advisory_lock(hashtext('wewed_notification_delivery_router')) AS acquired`,
  )
  if (!lock[0]?.acquired) return stats
  stats.locked = true

  try {
    const candidates = await notificationCandidates()
    stats.candidates = candidates.length
    let eligibleNotificationCount = 0

    for (const notification of candidates) {
      if (!(await isNotificationExternallyDeliverableToRecipient(notification))) {
        stats.authorizationRejected += 1
        continue
      }

      const channelFlags: Array<[NotificationExternalChannel, boolean]> = [
        ['email', notification.emailEnabled],
        ['whatsapp', notification.whatsAppEnabled],
        ['push', notification.pushEnabled],
      ]
      const channelDecisions = channelFlags.map(([channel, enabled]) => ({
        channel,
        enabled,
        decision: notificationExternalDeliveryDecision({
          channel,
          channelEnabled: enabled,
          digestMode: notification.digestMode,
          timezone: notification.timezone,
          quietStart: notification.quietStart,
          quietEnd: notification.quietEnd,
          now,
          state: notification.state,
          readAt: notification.readAt,
          scheduledFor: notification.scheduledFor,
          snoozedUntil: notification.snoozedUntil,
          expiresAt: notification.expiresAt,
        }),
      }))

      const eligibleChannels = channelDecisions.filter(({ decision }) => decision.eligible)
      if (eligibleChannels.length === 0) {
        stats.deferred += channelDecisions.filter(({ enabled, decision }) => enabled && !decision.eligible).length
        continue
      }

      if (eligibleNotificationCount >= safeLimit) break
      eligibleNotificationCount += 1

      for (const { channel } of eligibleChannels) {
        const history = await attemptHistory(notification.id, channel)
        if (!mayQueueAttempt(history, now)) continue
        if (await insertAttempt(notification.id, channel)) stats.queued += 1
      }
    }

    await processQueuedAttempts(safeLimit * 3, stats)
    return stats
  } finally {
    await db.$executeRawUnsafe(`SELECT pg_advisory_unlock(hashtext('wewed_notification_delivery_router'))`)
  }
}
