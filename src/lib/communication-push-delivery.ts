import 'server-only'

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { directWebPushConfigured, sendDirectWebPush } from '@/lib/notifications/web-push'

type ClaimedMessagePush = {
  id: string
  messageId: string
  recipientUserId: string
  attemptCount: number
  maxAttempts: number
  body: string
  conversationId: string
  senderName: string
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

type PushDispatchResult = {
  ok: boolean
  provider: 'web-push-direct'
  errorCode?: string
  retriable?: boolean
  unavailable?: boolean
  providerMessageId?: string
}

function retryDelaySeconds(attemptCount: number): number {
  return Math.min(3600, Math.max(15, 15 * (2 ** Math.max(0, attemptCount - 1))))
}

async function claimNextPushDelivery(): Promise<ClaimedMessagePush | null> {
  return db.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT delivery."id"
      FROM wewed_communications."CommunicationDelivery" delivery
      JOIN wewed_communications."CommunicationPreference" preference
        ON preference."userId" = delivery."recipientUserId"
       AND preference."channel" = 'PUSH'
       AND preference."enabled" = true
      WHERE delivery."status" = 'QUEUED'
        AND delivery."channel" = 'PUSH'
        AND delivery."endpointId" IS NULL
        AND (delivery."nextAttemptAt" IS NULL OR delivery."nextAttemptAt" <= now())
        AND EXISTS (
          SELECT 1
          FROM public."PushSubscription" subscription
          WHERE subscription."userId" = delivery."recipientUserId"
            AND subscription."disabledAt" IS NULL
            AND (subscription."expirationTime" IS NULL OR subscription."expirationTime" > ${(BigInt(Date.now()))})
        )
      ORDER BY delivery."createdAt", delivery."id"
      FOR UPDATE OF delivery SKIP LOCKED
      LIMIT 1
    `)
    const id = candidates[0]?.id
    if (!id) return null

    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationDelivery"
      SET "status" = 'PROCESSING',
          "attemptCount" = "attemptCount" + 1,
          "lastAttemptAt" = now(),
          "updatedAt" = now()
      WHERE "id" = ${id}
    `)

    const rows = await tx.$queryRaw<ClaimedMessagePush[]>(Prisma.sql`
      SELECT delivery."id", delivery."messageId", delivery."recipientUserId",
        delivery."attemptCount", delivery."maxAttempts", message."body", message."conversationId",
        COALESCE(NULLIF(btrim(sender."name"), ''), sender."email", 'Wewed') AS "senderName"
      FROM wewed_communications."CommunicationDelivery" delivery
      JOIN wewed_communications."CommunicationMessage" message ON message."id" = delivery."messageId"
      LEFT JOIN public."User" sender ON sender."id" = message."senderUserId"
      JOIN public."User" recipient ON recipient."id" = delivery."recipientUserId"
      WHERE delivery."id" = ${id}
        AND delivery."status" = 'PROCESSING'
        AND delivery."channel" = 'PUSH'
        AND message."deletedAt" IS NULL
        AND (message."visibility" = 'PARTICIPANTS' OR recipient."role" = 'admin')
      LIMIT 1
    `)
    if (rows[0]) return rows[0]

    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationDelivery"
      SET "status" = 'SKIPPED', "errorCode" = 'RECIPIENT_NOT_AUTHORIZED', "updatedAt" = now()
      WHERE "id" = ${id}
    `)
    return null
  })
}

async function activePushSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  return db.$queryRaw<PushSubscriptionRow[]>(Prisma.sql`
    SELECT "id", "endpoint", "p256dh", "auth"
    FROM public."PushSubscription"
    WHERE "userId" = ${userId}
      AND "disabledAt" IS NULL
      AND ("expirationTime" IS NULL OR "expirationTime" > ${BigInt(Date.now())})
    ORDER BY "createdAt"
  `)
}

async function dispatchMessagePush(delivery: ClaimedMessagePush): Promise<PushDispatchResult> {
  if (!directWebPushConfigured()) {
    return {
      ok: false,
      provider: 'web-push-direct',
      errorCode: 'TRANSPORT_NOT_CONFIGURED',
      unavailable: true,
    }
  }

  const subscriptions = await activePushSubscriptions(delivery.recipientUserId)
  if (subscriptions.length === 0) {
    return {
      ok: false,
      provider: 'web-push-direct',
      errorCode: 'NO_ACTIVE_PUSH_SUBSCRIPTION',
      unavailable: true,
    }
  }

  const payload = {
    notification: {
      title: `Message from ${delivery.senderName}`,
      body: delivery.body.slice(0, 240),
      deepLink: `/messages?conversation=${encodeURIComponent(delivery.conversationId)}`,
      tag: `wewed-message-${delivery.conversationId}`,
    },
    kind: 'communication_message',
    messageId: delivery.messageId,
  }

  const results = await Promise.all(subscriptions.map(async (subscription) => ({
    subscription,
    result: await sendDirectWebPush(subscription, payload),
  })))

  const expiredIds = results
    .filter((item) => item.result.expired)
    .map((item) => item.subscription.id)
  if (expiredIds.length > 0) {
    await db.$executeRaw(Prisma.sql`
      UPDATE public."PushSubscription"
      SET "disabledAt" = COALESCE("disabledAt", now()), "updatedAt" = now()
      WHERE "userId" = ${delivery.recipientUserId}
        AND "id" IN (${Prisma.join(expiredIds)})
    `)
  }

  const successes = results.filter((item) => item.result.ok)
  if (successes.length > 0) {
    return {
      ok: true,
      provider: 'web-push-direct',
      providerMessageId: `devices:${successes.length}`,
    }
  }

  const retriable = results.some((item) => item.result.retriable)
  const allExpired = results.every((item) => item.result.expired)
  return {
    ok: false,
    provider: 'web-push-direct',
    errorCode: allExpired ? 'NO_ACTIVE_PUSH_SUBSCRIPTION' : 'PUSH_DELIVERY_FAILED',
    retriable: retriable && !allExpired,
    unavailable: allExpired,
  }
}

async function finishPushDelivery(delivery: ClaimedMessagePush, result: PushDispatchResult) {
  const now = new Date()
  if (result.ok) {
    await db.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationDelivery"
      SET "status" = 'SENT', "provider" = ${result.provider},
          "providerMessageId" = ${result.providerMessageId ?? null}, "errorCode" = NULL,
          "sentAt" = ${now}, "nextAttemptAt" = NULL, "updatedAt" = ${now}
      WHERE "id" = ${delivery.id} AND "status" = 'PROCESSING'
    `)
    return 'SENT'
  }

  if (result.unavailable) {
    await db.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationDelivery"
      SET "status" = 'SKIPPED', "provider" = ${result.provider},
          "errorCode" = ${result.errorCode ?? 'PUSH_UNAVAILABLE'}, "nextAttemptAt" = NULL, "updatedAt" = ${now}
      WHERE "id" = ${delivery.id} AND "status" = 'PROCESSING'
    `)
    return 'SKIPPED'
  }

  const retry = result.retriable === true && delivery.attemptCount < delivery.maxAttempts
  const nextAttempt = retry
    ? new Date(now.getTime() + retryDelaySeconds(delivery.attemptCount) * 1000)
    : null
  await db.$executeRaw(Prisma.sql`
    UPDATE wewed_communications."CommunicationDelivery"
    SET "status" = ${retry ? 'QUEUED' : 'FAILED'}, "provider" = ${result.provider},
        "errorCode" = ${result.errorCode ?? 'PUSH_DELIVERY_FAILED'}, "nextAttemptAt" = ${nextAttempt},
        "failedAt" = ${retry ? null : now}, "updatedAt" = ${now}
    WHERE "id" = ${delivery.id} AND "status" = 'PROCESSING'
  `)
  return retry ? 'QUEUED' : 'FAILED'
}

export async function processQueuedCommunicationPushDeliveries(limit = 20) {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)))
  const deliveries: Array<{ id: string; channel: 'PUSH'; status: string }> = []

  for (let index = 0; index < safeLimit; index += 1) {
    const delivery = await claimNextPushDelivery()
    if (!delivery) break
    const result = await dispatchMessagePush(delivery)
    const status = await finishPushDelivery(delivery, result)
    deliveries.push({ id: delivery.id, channel: 'PUSH', status })
  }

  return { processed: deliveries.length, deliveries }
}
