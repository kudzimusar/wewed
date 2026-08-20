import { z } from 'zod'

const quietTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

export const notificationPreferenceInputSchema = z.object({
  scopeKey: z.string().trim().min(1).max(120).default('global'),
  // In-app history is Wewed's canonical notification record and cannot be disabled.
  inAppEnabled: z.literal(true).default(true),
  pushEnabled: z.boolean().default(false),
  emailEnabled: z.boolean().default(false),
  whatsAppEnabled: z.boolean().default(false),
  timezone: z.string().trim().min(1).max(100).default('UTC').refine(
    isValidTimezone,
    'Use a valid IANA timezone, for example Africa/Harare or Asia/Tokyo.',
  ),
  quietStart: quietTimeSchema.optional().nullable(),
  quietEnd: quietTimeSchema.optional().nullable(),
  // Daily/weekly digest generation is intentionally deferred; accepting those values today
  // would defer external notifications indefinitely without creating a digest.
  digestMode: z.literal('none').default('none'),
}).superRefine((value, context) => {
  const hasStart = Boolean(value.quietStart)
  const hasEnd = Boolean(value.quietEnd)
  if (hasStart !== hasEnd) {
    context.addIssue({
      code: 'custom',
      path: hasStart ? ['quietEnd'] : ['quietStart'],
      message: 'Set both quiet-hour times, or leave both blank.',
    })
  }
  if (value.quietStart && value.quietEnd && value.quietStart === value.quietEnd) {
    context.addIssue({
      code: 'custom',
      path: ['quietEnd'],
      message: 'Quiet-hour start and end must be different.',
    })
  }
})

export type NotificationPreferenceInput = z.input<typeof notificationPreferenceInputSchema>
