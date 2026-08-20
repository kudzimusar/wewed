export type NotificationExternalChannel = 'email' | 'whatsapp' | 'push'

export interface NotificationDeliveryPolicyInput {
  channel: NotificationExternalChannel
  channelEnabled: boolean
  digestMode: 'none' | 'daily' | 'weekly'
  timezone: string
  quietStart: string | null
  quietEnd: string | null
  now: Date
  state: string
  readAt: Date | null
  scheduledFor: Date | null
  snoozedUntil: Date | null
  expiresAt: Date | null
}

export interface NotificationDeliveryPolicyDecision {
  eligible: boolean
  reason:
    | 'eligible'
    | 'channel_disabled'
    | 'terminal_or_inactive'
    | 'already_read'
    | 'scheduled_for_later'
    | 'snoozed'
    | 'expired'
    | 'digest_deferred'
    | 'quiet_hours'
    | 'invalid_timezone'
}

const ACTIVE_EXTERNAL_STATES = new Set(['active', 'queued'])

function parseClock(value: string | null): number | null {
  if (!value) return null
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function localMinuteOfDay(date: Date, timezone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const hour = Number(parts.find((part) => part.type === 'hour')?.value)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value)
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
    return hour * 60 + minute
  } catch {
    return null
  }
}

export function isInNotificationQuietHours(
  now: Date,
  timezone: string,
  quietStart: string | null,
  quietEnd: string | null,
): boolean | null {
  const start = parseClock(quietStart)
  const end = parseClock(quietEnd)
  if (start === null || end === null || start === end) return false
  const local = localMinuteOfDay(now, timezone)
  if (local === null) return null
  if (start < end) return local >= start && local < end
  return local >= start || local < end
}

export function notificationExternalDeliveryDecision(
  input: NotificationDeliveryPolicyInput,
): NotificationDeliveryPolicyDecision {
  if (!input.channelEnabled) return { eligible: false, reason: 'channel_disabled' }
  if (!ACTIVE_EXTERNAL_STATES.has(input.state)) {
    return { eligible: false, reason: 'terminal_or_inactive' }
  }
  if (input.readAt) return { eligible: false, reason: 'already_read' }
  if (input.expiresAt && input.expiresAt.getTime() <= input.now.getTime()) {
    return { eligible: false, reason: 'expired' }
  }
  if (input.snoozedUntil && input.snoozedUntil.getTime() > input.now.getTime()) {
    return { eligible: false, reason: 'snoozed' }
  }
  if (input.scheduledFor && input.scheduledFor.getTime() > input.now.getTime()) {
    return { eligible: false, reason: 'scheduled_for_later' }
  }
  if (input.digestMode !== 'none') {
    return { eligible: false, reason: 'digest_deferred' }
  }
  const quiet = isInNotificationQuietHours(
    input.now,
    input.timezone,
    input.quietStart,
    input.quietEnd,
  )
  if (quiet === null) return { eligible: false, reason: 'invalid_timezone' }
  if (quiet) return { eligible: false, reason: 'quiet_hours' }
  return { eligible: true, reason: 'eligible' }
}

export function notificationRetryDelayMs(attemptNumber: number): number {
  const normalized = Math.max(1, Math.trunc(attemptNumber))
  const seconds = Math.min(3600, 30 * (2 ** Math.max(0, normalized - 1)))
  return seconds * 1000
}
