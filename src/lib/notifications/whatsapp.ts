import 'server-only'

export interface NotificationWhatsAppRequestInput {
  normalizedAddress: string
  notificationId: string
  title: string
}

export interface NotificationWhatsAppRequest {
  url: string
  headers: Record<string, string>
  body: unknown
}

export function buildNotificationWhatsAppActionRequest(
  input: NotificationWhatsAppRequestInput,
): NotificationWhatsAppRequest | null {
  const token = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim()
  const version = process.env.WHATSAPP_CLOUD_GRAPH_VERSION?.trim()
  const template = process.env.WEWED_WHATSAPP_ACTION_TEMPLATE?.trim()
  if (!token || !phoneNumberId || !version || !template) return null

  const base = (process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL || 'https://graph.facebook.com').replace(/\/$/, '')
  const language = process.env.WEWED_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en_US'
  const to = input.normalizedAddress.replace(/^\+/, '')

  // Approved template contract:
  //   Body {{1}}: the notification title/context.
  //   URL button 0: https://wewed.pro/notifications/open/{{1}}
  // The dynamic URL suffix is only the opaque Notification id; Wewed rechecks authorization on open.
  return {
    url: `${base}/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: input.title.slice(0, 256) }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: input.notificationId.slice(0, 128) }],
          },
        ],
      },
    },
  }
}
