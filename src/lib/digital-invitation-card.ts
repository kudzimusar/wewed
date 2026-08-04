export const INVITATION_CARD_STYLES = [
  {
    id: 'botanical',
    name: 'Botanical',
    description: 'Soft ivory, garden greens and a timeless formal layout.',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Clean typography, bold spacing and a modern magazine feel.',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep evening tones with warm metallic details.',
  },
] as const

export type InvitationCardStyle = (typeof INVITATION_CARD_STYLES)[number]['id']

const STYLE_IDS = new Set<string>(INVITATION_CARD_STYLES.map((style) => style.id))

export function normalizeInvitationCardStyle(value: unknown): InvitationCardStyle {
  return typeof value === 'string' && STYLE_IDS.has(value)
    ? (value as InvitationCardStyle)
    : 'botanical'
}

export function buildDigitalInvitationUrl({
  siteUrl,
  weddingSlug,
  token,
  style,
}: {
  siteUrl: string
  weddingSlug: string
  token: string
  style: InvitationCardStyle
}): string {
  const origin = siteUrl.replace(/\/$/, '')
  const query = new URLSearchParams({ rsvp: token, card: style })
  return `${origin}/w/${encodeURIComponent(weddingSlug)}?${query.toString()}`
}

export function buildDigitalInvitationMessage({
  guestName,
  weddingTitle,
  invitationUrl,
}: {
  guestName: string
  weddingTitle: string
  invitationUrl: string
}): string {
  return `Dear ${guestName},\n\nYou are warmly invited to ${weddingTitle}. Open your private digital wedding card and RSVP here:\n${invitationUrl}\n\nThis link is personal to you. Please do not forward it.`
}
