import type { InvitationCardStyle } from '@/lib/digital-invitation-card'

export const ANDROID_PACKAGE = 'pro.wewed.app'
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

const INVITATION_HANDOFF_PATTERN = /^[A-Za-z0-9_-]{43}$/

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

export function isValidInvitationHandoffSecret(secret: string): boolean {
  return INVITATION_HANDOFF_PATTERN.test(secret)
}

export function buildPlayStoreInstallUrl(handoff: string): string {
  if (!isValidInvitationHandoffSecret(handoff)) {
    throw new Error('Invalid invitation install handoff')
  }

  const referrer = new URLSearchParams({ handoff }).toString()
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(referrer)}`
}

export function buildPhysicalPlayStoreInstallUrl(handoff: string): string {
  if (!isValidInvitationHandoffSecret(handoff)) {
    throw new Error('Invalid physical invitation install handoff')
  }

  const referrer = new URLSearchParams({ physical_handoff: handoff }).toString()
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(referrer)}`
}

export function buildInvitationResumePath(handoff: string): string {
  if (!isValidInvitationHandoffSecret(handoff)) {
    throw new Error('Invalid invitation install handoff')
  }
  return `/invite/resume?${new URLSearchParams({ h: handoff }).toString()}`
}

export function buildPhysicalInvitationResumePath(handoff: string): string {
  if (!isValidInvitationHandoffSecret(handoff)) {
    throw new Error('Invalid physical invitation install handoff')
  }
  return `/invite/physical-resume?${new URLSearchParams({ h: handoff }).toString()}`
}
