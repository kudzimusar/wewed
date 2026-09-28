import { describe, expect, test } from 'bun:test'
import {
  INVITATION_DELIVERY_CLEARED_ACTION,
  INVITATION_DELIVERY_SENT_ACTION,
  parseInvitationDeliveryAudit,
  summarizeInvitationDeliveryAudits,
} from './planner-invitation-delivery'

describe('Planner invitation delivery audit projection', () => {
  test('records sent metadata without requiring a private invitation URL', () => {
    const row = parseInvitationDeliveryAudit({
      action: INVITATION_DELIVERY_SENT_ACTION,
      resourceId: 'guest-a',
      afterValue: JSON.stringify({
        channel: 'whatsapp',
        recipient: '+263700000000',
        cardStyle: 'ivory-floral-gold',
        invitationFingerprint: 'safe-fingerprint',
        messageTemplate: 'wewed-personal-invitation-v1',
      }),
      createdAt: new Date('2026-09-29T01:00:00Z'),
    })

    expect(row).toEqual({
      action: 'sent',
      guestId: 'guest-a',
      channel: 'whatsapp',
      recipient: '+263700000000',
      cardStyle: 'ivory-floral-gold',
      invitationFingerprint: 'safe-fingerprint',
      messageTemplate: 'wewed-personal-invitation-v1',
      createdAt: '2026-09-29T01:00:00.000Z',
    })
  })

  test('a later clear keeps history but returns the guest to not sent', () => {
    const summary = summarizeInvitationDeliveryAudits([
      {
        action: INVITATION_DELIVERY_SENT_ACTION,
        resourceId: 'guest-a',
        afterValue: JSON.stringify({ channel: 'email', recipient: 'a@example.com' }),
        createdAt: new Date('2026-09-29T01:00:00Z'),
      },
      {
        action: INVITATION_DELIVERY_CLEARED_ACTION,
        resourceId: 'guest-a',
        afterValue: JSON.stringify({ reason: 'planner_correction' }),
        createdAt: new Date('2026-09-29T02:00:00Z'),
      },
    ]).get('guest-a')

    expect(summary?.status).toBe('not_sent')
    expect(summary?.lastSentAt).toBeNull()
    expect(summary?.sentCount).toBe(1)
    expect(summary?.historyCount).toBe(2)
  })

  test('ignores malformed historical payloads rather than breaking the Planner', () => {
    const summary = summarizeInvitationDeliveryAudits([{
      action: INVITATION_DELIVERY_SENT_ACTION,
      resourceId: 'guest-a',
      afterValue: '{not-json',
      createdAt: new Date('2026-09-29T03:00:00Z'),
    }]).get('guest-a')

    expect(summary?.status).toBe('sent')
    expect(summary?.channel).toBeNull()
  })
})
