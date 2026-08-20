import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { AppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import { NotificationAccessError } from '@/lib/notifications/service'

export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().max(4000),
  expirationTime: z.number().int().positive().optional().nullable(),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(1000),
    auth: z.string().trim().min(1).max(1000),
  }),
})

export interface PushSubscriptionRecord {
  id: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  expirationTime: bigint | null
  userAgent: string | null
  disabledAt: Date | null
  lastSeenAt: Date
  createdAt: Date
  updatedAt: Date
}

function principalUserId(session: AppSession): string {
  const userId = session.effectiveUserId ?? session.userId ?? null
  if (!userId) throw new NotificationAccessError('Authenticated user id is required.')
  return userId
}

export async function registerPushSubscription(
  session: AppSession,
  input: z.input<typeof pushSubscriptionInputSchema>,
  userAgent: string | null,
): Promise<PushSubscriptionRecord> {
  const userId = principalUserId(session)
  const parsed = pushSubscriptionInputSchema.parse(input)
  const id = randomUUID()
  const rows = await db.$queryRawUnsafe<PushSubscriptionRecord[]>(
    `
      INSERT INTO public."PushSubscription" (
        id, "userId", endpoint, p256dh, auth, "expirationTime", "userAgent",
        "disabledAt", "lastSeenAt", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (endpoint)
      DO UPDATE SET
        "userId" = EXCLUDED."userId",
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        "expirationTime" = EXCLUDED."expirationTime",
        "userAgent" = EXCLUDED."userAgent",
        "disabledAt" = NULL,
        "lastSeenAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `,
    id,
    userId,
    parsed.endpoint,
    parsed.keys.p256dh,
    parsed.keys.auth,
    parsed.expirationTime ?? null,
    userAgent,
  )
  if (!rows[0]) throw new Error('Unable to register push subscription.')
  return rows[0]
}

export async function disablePushSubscription(
  session: AppSession,
  endpoint: string,
): Promise<boolean> {
  const userId = principalUserId(session)
  const parsedEndpoint = z.string().url().max(4000).parse(endpoint)
  const updated = await db.$executeRawUnsafe(
    `
      UPDATE public."PushSubscription"
      SET "disabledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = $1 AND endpoint = $2 AND "disabledAt" IS NULL
    `,
    userId,
    parsedEndpoint,
  )
  return updated > 0
}

export async function listActivePushSubscriptions(
  userId: string,
): Promise<PushSubscriptionRecord[]> {
  return db.$queryRawUnsafe<PushSubscriptionRecord[]>(
    `
      SELECT *
      FROM public."PushSubscription"
      WHERE "userId" = $1 AND "disabledAt" IS NULL
      ORDER BY "lastSeenAt" DESC
    `,
    userId,
  )
}
