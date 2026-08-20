import { describe, expect, it } from 'bun:test'
import {
  isInNotificationQuietHours,
  notificationExternalDeliveryDecision,
  notificationRetryDelayMs,
} from './delivery-policy'

const now = new Date('2026-08-20T12:00:00.000Z')

function base() {
  return {
    channel: 'email' as const,
    channelEnabled: true,
    digestMode: 'none' as const,
    timezone: 'UTC',
    quietStart: null,
    quietEnd: null,
    now,
    state: 'active',
    readAt: null,
    scheduledFor: null,
    snoozedUntil: null,
    expiresAt: null,
  }
}

describe('notification external delivery policy', () => {
  it('allows only an opted-in active unread notification', () => {
    expect(notificationExternalDeliveryDecision(base())).toEqual({ eligible: true, reason: 'eligible' })
    expect(notificationExternalDeliveryDecision({ ...base(), channelEnabled: false }).reason).toBe('channel_disabled')
    expect(notificationExternalDeliveryDecision({ ...base(), state: 'resolved' }).reason).toBe('terminal_or_inactive')
    expect(notificationExternalDeliveryDecision({ ...base(), readAt: now }).reason).toBe('already_read')
  })

  it('does not externally send scheduled, snoozed, expired or digest-deferred attention', () => {
    expect(notificationExternalDeliveryDecision({ ...base(), scheduledFor: new Date(now.getTime() + 60_000) }).reason).toBe('scheduled_for_later')
    expect(notificationExternalDeliveryDecision({ ...base(), snoozedUntil: new Date(now.getTime() + 60_000) }).reason).toBe('snoozed')
    expect(notificationExternalDeliveryDecision({ ...base(), expiresAt: now }).reason).toBe('expired')
    expect(notificationExternalDeliveryDecision({ ...base(), digestMode: 'daily' }).reason).toBe('digest_deferred')
  })

  it('enforces normal and overnight quiet-hour windows in the user timezone', () => {
    expect(isInNotificationQuietHours(now, 'UTC', '11:00', '13:00')).toBe(true)
    expect(isInNotificationQuietHours(now, 'UTC', '13:00', '15:00')).toBe(false)
    expect(isInNotificationQuietHours(new Date('2026-08-20T23:00:00.000Z'), 'UTC', '22:00', '07:00')).toBe(true)
    expect(isInNotificationQuietHours(new Date('2026-08-20T12:00:00.000Z'), 'UTC', '22:00', '07:00')).toBe(false)
  })

  it('fails closed on invalid timezone configuration', () => {
    expect(notificationExternalDeliveryDecision({ ...base(), timezone: 'Not/AZone', quietStart: '22:00', quietEnd: '07:00' })).toEqual({
      eligible: false,
      reason: 'invalid_timezone',
    })
  })

  it('uses bounded exponential retry delays', () => {
    expect(notificationRetryDelayMs(1)).toBe(30_000)
    expect(notificationRetryDelayMs(2)).toBe(60_000)
    expect(notificationRetryDelayMs(20)).toBe(3_600_000)
  })
})
