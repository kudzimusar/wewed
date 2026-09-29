export const INVITATION_DELIVERY_SENT_ACTION = 'guest.invitation_sent'
export const INVITATION_DELIVERY_CLEARED_ACTION = 'guest.invitation_sent_cleared'
export const INVITATION_DELIVERY_RESOURCE = 'guest_invitation'

export const INVITATION_DELIVERY_CHANNELS = [
  'whatsapp',
  'email',
  'sms',
  'share_sheet',
  'copy_link',
  'qr',
  'manual',
] as const

export type InvitationDeliveryChannel = (typeof INVITATION_DELIVERY_CHANNELS)[number]

export interface InvitationDeliveryAuditRow {
  action: string
  resourceId: string | null
  afterValue: string | null
  createdAt: Date
}

export interface InvitationDeliveryRecord {
  action: 'sent' | 'cleared'
  guestId: string
  channel: InvitationDeliveryChannel | null
  recipient: string | null
  cardStyle: string | null
  invitationMessage: string | null
  rsvpDeadline: string | null
  childrenPolicy: string | null
  invitationFingerprint: string | null
  messageTemplate: string | null
  createdAt: string
}

export interface InvitationDeliverySummary {
  status: 'sent' | 'not_sent'
  lastSentAt: string | null
  channel: InvitationDeliveryChannel | null
  recipient: string | null
  cardStyle: string | null
  sentCount: number
  historyCount: number
}

const EMPTY_SUMMARY: InvitationDeliverySummary = {
  status: 'not_sent',
  lastSentAt: null,
  channel: null,
  recipient: null,
  cardStyle: null,
  sentCount: 0,
  historyCount: 0,
}

function asChannel(value: unknown): InvitationDeliveryChannel | null {
  return typeof value === 'string' && (INVITATION_DELIVERY_CHANNELS as readonly string[]).includes(value)
    ? value as InvitationDeliveryChannel
    : null
}

export function parseInvitationDeliveryAudit(row: InvitationDeliveryAuditRow): InvitationDeliveryRecord | null {
  if (!row.resourceId) return null
  if (row.action !== INVITATION_DELIVERY_SENT_ACTION && row.action !== INVITATION_DELIVERY_CLEARED_ACTION) {
    return null
  }

  let payload: Record<string, unknown> = {}
  if (row.afterValue) {
    try {
      const parsed = JSON.parse(row.afterValue)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>
    } catch {
      // Historical audit data must never make the Planner invitation page unavailable.
    }
  }

  return {
    action: row.action === INVITATION_DELIVERY_SENT_ACTION ? 'sent' : 'cleared',
    guestId: row.resourceId,
    channel: asChannel(payload.channel),
    recipient: typeof payload.recipient === 'string' ? payload.recipient : null,
    cardStyle: typeof payload.cardStyle === 'string' ? payload.cardStyle : null,
    invitationMessage: typeof payload.invitationMessage === 'string' ? payload.invitationMessage : null,
    rsvpDeadline: typeof payload.rsvpDeadline === 'string' ? payload.rsvpDeadline : null,
    childrenPolicy: typeof payload.childrenPolicy === 'string' ? payload.childrenPolicy : null,
    invitationFingerprint: typeof payload.invitationFingerprint === 'string' ? payload.invitationFingerprint : null,
    messageTemplate: typeof payload.messageTemplate === 'string' ? payload.messageTemplate : null,
    createdAt: row.createdAt.toISOString(),
  }
}

export function summarizeInvitationDeliveryAudits(
  rows: InvitationDeliveryAuditRow[],
): Map<string, InvitationDeliverySummary> {
  const history = new Map<string, InvitationDeliveryRecord[]>()

  for (const row of rows) {
    const parsed = parseInvitationDeliveryAudit(row)
    if (!parsed) continue
    const current = history.get(parsed.guestId) ?? []
    current.push(parsed)
    history.set(parsed.guestId, current)
  }

  const summaries = new Map<string, InvitationDeliverySummary>()
  for (const [guestId, records] of history) {
    records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    const latest = records[0]
    const sent = records.filter((record) => record.action === 'sent')
    const latestSent = sent[0] ?? null
    summaries.set(guestId, {
      status: latest?.action === 'sent' ? 'sent' : 'not_sent',
      lastSentAt: latest?.action === 'sent' ? latest.createdAt : null,
      channel: latest?.action === 'sent' ? latest.channel : null,
      recipient: latest?.action === 'sent' ? latest.recipient : null,
      cardStyle: latest?.action === 'sent' ? latest.cardStyle : null,
      sentCount: sent.length,
      historyCount: records.length,
    })
  }

  return summaries
}

export function emptyInvitationDeliverySummary(): InvitationDeliverySummary {
  return { ...EMPTY_SUMMARY }
}
