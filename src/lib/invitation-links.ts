import type { InvitationCardStyle } from '@/lib/digital-invitation-card'

export function buildSmartInvitationUrl({
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
  return `${origin}/invite/${encodeURIComponent(weddingSlug)}?${query.toString()}`
}

export function buildInvitationContinuePath({
  weddingSlug,
  source,
}: {
  weddingSlug: string
  source?: string
}): string {
  const path = `/invite/${encodeURIComponent(weddingSlug)}/continue`
  if (!source) return path
  return `${path}?${new URLSearchParams({ source }).toString()}`
}
