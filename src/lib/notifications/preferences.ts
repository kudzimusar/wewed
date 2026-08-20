import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { AppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import { NotificationAccessError } from '@/lib/notifications/service'

const quietTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const notificationPreferenceInputSchema = z.object({
  scopeKey: z.string().trim().min(1).max(120).default('global'),
  inAppEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(false),
  emailEnabled: z.boolean().default(false),
  whatsAppEnabled: z.boolean().default(false),
  timezone: z.string().trim().min(1).max(100).default('UTC'),
  quietStart: quietTimeSchema.optional().nullable(),
  quietEnd: quietTimeSchema.optional().nullable(),
  digestMode: z.enum(['none', 'daily', 'weekly']).default('none'),
})

export type NotificationPreferenceInput = z.input<typeof notificationPreferenceInputSchema>

export interface NotificationPreferenceRecord {
  id: string
  userId: string
  scopeKey: string
  inAppEnabled: boolean
  pushEnabled: boolean
  emailEnabled: boolean
  whatsAppEnabled: boolean
  timezone: string
  quietStart: string | null
  quietEnd: string | null
  digestMode: 'none' | 'daily' | 'weekly'
  createdAt: Date
  updatedAt: Date
}

function principalUserId(session: AppSession): string {
  const userId = session.effectiveUserId ?? session.userId ?? null
  if (!userId) throw new NotificationAccessError('Authenticated user id is required.')
  return userId
}

export async function getNotificationPreferences(
  session: AppSession,
  scopeKey = 'global',
): Promise<NotificationPreferenceRecord> {
  const userId = principalUserId(session)
  const rows = await db.$queryRawUnsafe<NotificationPreferenceRecord[]>(
    `
      SELECT *
      FROM public."NotificationPreference"
      WHERE "userId" = $1 AND "scopeKey" = $2
      LIMIT 1
    `,
    userId,
    scopeKey,
  )
  if (rows[0]) return rows[0]

  return {
    id: '',
    userId,
    scopeKey,
    inAppEnabled: true,
    pushEnabled: false,
    emailEnabled: false,
    whatsAppEnabled: false,
    timezone: 'UTC',
    quietStart: null,
    quietEnd: null,
    digestMode: 'none',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

export async function saveNotificationPreferences(
  session: AppSession,
  input: NotificationPreferenceInput,
): Promise<NotificationPreferenceRecord> {
  const userId = principalUserId(session)
  const parsed = notificationPreferenceInputSchema.parse(input)
  const id = randomUUID()
  const rows = await db.$queryRawUnsafe<NotificationPreferenceRecord[]>(
    `
      INSERT INTO public."NotificationPreference" (
        id, "userId", "scopeKey", "inAppEnabled", "pushEnabled", "emailEnabled",
        "whatsAppEnabled", timezone, "quietStart", "quietEnd", "digestMode",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId", "scopeKey")
      DO UPDATE SET
        "inAppEnabled" = EXCLUDED."inAppEnabled",
        "pushEnabled" = EXCLUDED."pushEnabled",
        "emailEnabled" = EXCLUDED."emailEnabled",
        "whatsAppEnabled" = EXCLUDED."whatsAppEnabled",
        timezone = EXCLUDED.timezone,
        "quietStart" = EXCLUDED."quietStart",
        "quietEnd" = EXCLUDED."quietEnd",
        "digestMode" = EXCLUDED."digestMode",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `,
    id,
    userId,
    parsed.scopeKey,
    parsed.inAppEnabled,
    parsed.pushEnabled,
    parsed.emailEnabled,
    parsed.whatsAppEnabled,
    parsed.timezone,
    parsed.quietStart ?? null,
    parsed.quietEnd ?? null,
    parsed.digestMode,
  )
  if (!rows[0]) throw new Error('Unable to save notification preferences.')
  return rows[0]
}
