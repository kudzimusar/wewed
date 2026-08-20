import { z } from 'zod'

export const NOTIFICATION_CATEGORIES = [
  'task',
  'budget',
  'payment',
  'vendor',
  'engagement',
  'contract',
  'rsvp',
  'guest',
  'programme',
  'wedding',
  'message',
  'communication',
  'contribution',
  'admin',
  'system',
] as const

export const NOTIFICATION_SEVERITIES = [
  'info',
  'normal',
  'important',
  'action_required',
  'urgent',
] as const

export const NOTIFICATION_STATES = [
  'scheduled',
  'queued',
  'active',
  'read',
  'acknowledged',
  'resolved',
  'dismissed',
  'cancelled',
  'expired',
  'failed',
] as const

export const REMINDER_STATES = [
  'scheduled',
  'triggered',
  'snoozed',
  'cancelled',
  'completed',
  'failed',
] as const

export const NOTIFICATION_CHANNELS = ['in_app', 'push', 'email', 'whatsapp'] as const
export const DELIVERY_STATES = ['queued', 'sent', 'delivered', 'read', 'failed', 'cancelled'] as const

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES)
export const notificationSeveritySchema = z.enum(NOTIFICATION_SEVERITIES)
export const notificationStateSchema = z.enum(NOTIFICATION_STATES)
export const reminderStateSchema = z.enum(REMINDER_STATES)
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS)
export const deliveryStateSchema = z.enum(DELIVERY_STATES)

export type NotificationCategory = z.infer<typeof notificationCategorySchema>
export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>
export type NotificationState = z.infer<typeof notificationStateSchema>
export type ReminderState = z.infer<typeof reminderStateSchema>
export type NotificationChannel = z.infer<typeof notificationChannelSchema>
export type DeliveryState = z.infer<typeof deliveryStateSchema>

const optionalNonEmptyString = z.string().trim().min(1).optional().nullable()

export const createNotificationInputSchema = z.object({
  recipientUserId: z.string().trim().min(1),
  weddingId: optionalNonEmptyString,
  actorUserId: optionalNonEmptyString,
  sourceType: z.string().trim().min(1).max(80),
  sourceId: optionalNonEmptyString,
  eventType: z.string().trim().min(1).max(120),
  category: notificationCategorySchema,
  severity: notificationSeveritySchema.default('normal'),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(4000),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  deepLink: optionalNonEmptyString,
  actionType: optionalNonEmptyString,
  requiresAction: z.boolean().default(false),
  state: notificationStateSchema.default('active'),
  scheduledFor: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  dedupeKey: z.string().trim().min(1).max(240).optional().nullable(),
})

export type CreateNotificationInput = z.input<typeof createNotificationInputSchema>
export type ParsedCreateNotificationInput = z.output<typeof createNotificationInputSchema>

export const notificationListFilterSchema = z.object({
  state: notificationStateSchema.optional(),
  category: notificationCategorySchema.optional(),
  weddingId: z.string().trim().min(1).optional(),
  unreadOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(50),
})

export type NotificationListFilter = z.input<typeof notificationListFilterSchema>

export const snoozeNotificationInputSchema = z.object({
  notificationId: z.string().trim().min(1),
  triggerAt: z.coerce.date(),
  timezone: z.string().trim().min(1).max(100).default('UTC'),
})

export type SnoozeNotificationInput = z.input<typeof snoozeNotificationInputSchema>

export interface NotificationRecord {
  id: string
  recipientUserId: string
  weddingId: string | null
  actorUserId: string | null
  sourceType: string
  sourceId: string | null
  eventType: string
  category: NotificationCategory
  severity: NotificationSeverity
  title: string
  body: string
  metadata: Record<string, unknown> | null
  deepLink: string | null
  actionType: string | null
  requiresAction: boolean
  state: NotificationState
  readAt: Date | null
  acknowledgedAt: Date | null
  resolvedAt: Date | null
  scheduledFor: Date | null
  snoozedUntil: Date | null
  expiresAt: Date | null
  dedupeKey: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ReminderRecord {
  id: string
  ownerUserId: string
  recipientUserId: string
  weddingId: string | null
  sourceType: string
  sourceId: string | null
  triggerAt: Date
  timezone: string
  state: ReminderState
  deliveryPolicy: Record<string, unknown> | null
  dedupeKey: string | null
  generatedNotificationId: string | null
  snoozedFromReminderId: string | null
  triggeredAt: Date | null
  cancelledAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

const ALLOWED_NOTIFICATION_TRANSITIONS: Record<NotificationState, readonly NotificationState[]> = {
  scheduled: ['queued', 'active', 'cancelled', 'expired', 'failed'],
  queued: ['active', 'cancelled', 'failed'],
  active: ['scheduled', 'read', 'acknowledged', 'resolved', 'dismissed', 'cancelled', 'expired', 'failed'],
  read: ['active', 'scheduled', 'acknowledged', 'resolved', 'dismissed', 'cancelled', 'expired'],
  acknowledged: ['scheduled', 'resolved', 'dismissed', 'cancelled', 'expired'],
  resolved: [],
  dismissed: ['active', 'scheduled', 'resolved'],
  cancelled: [],
  expired: [],
  failed: ['queued', 'active', 'cancelled'],
}

export function canTransitionNotificationState(
  from: NotificationState,
  to: NotificationState,
): boolean {
  return from === to || ALLOWED_NOTIFICATION_TRANSITIONS[from].includes(to)
}

export function isTerminalNotificationState(state: NotificationState): boolean {
  return state === 'resolved' || state === 'cancelled' || state === 'expired'
}

export function effectiveNotificationStateForRead(
  current: NotificationState,
  read: boolean,
): NotificationState {
  if (isTerminalNotificationState(current) || current === 'acknowledged') return current
  if (read) return current === 'active' ? 'read' : current
  return current === 'read' ? 'active' : current
}
