import type { InvitationCardStyle } from '@/lib/digital-invitation-card'

export const ANDROID_PACKAGE = 'pro.wewed.app'
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

const INVITATION_HANDOFF_PATTERN = /^[A-Za-z0-9_-]{43}$/
const PHYSICAL_INVITATION_HANDOFF_PATTERN = /^p1\.[A-Za-z0-9_-]{80,512}$/

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

export function isValidPhysicalInvitationHandoff(secret: string): boolean {
  return PHYSICAL_INVITATION_HANDOFF_PATTERN.test(secret)
}

export function buildPlayStoreInstallUrl(handoff: string): string {
  if (!isValidInvitationHandoffSecret(handoff)) {
    throw new Error('Invalid invitation install handoff')
  }

  const referrer = new URLSearchParams({ handoff }).toString()
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(referrer)}`
}

export function buildPhysicalPlayStoreInstallUrl(handoff: string): string {
  if (!isValidPhysicalInvitationHandoff(handoff)) {
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


export function buildAndroidInvitationIntentUrl({
  origin,
  appResumePath,
  fallbackUrl,
}: {
  origin: string
  appResumePath: string
  fallbackUrl: string
}): string {
  const currentOrigin = new URL(origin)
  const resume = new URL(appResumePath, currentOrigin)

  if (resume.origin !== currentOrigin.origin) {
    throw new Error('Invitation app resume must stay on the current Wewed origin')
  }

  if (resume.pathname !== '/invite/resume') {
    throw new Error('Invalid invitation app resume path')
  }

  const handoff = resume.searchParams.get('h') || ''
  if (!isValidInvitationHandoffSecret(handoff) || resume.searchParams.has('rsvp')) {
    throw new Error('Invalid invitation app resume handoff')
  }

  const target = `${currentOrigin.host}${resume.pathname}${resume.search}`
  const scheme = currentOrigin.protocol.replace(/:$/, '')
  return `intent://${target}#Intent;scheme=${scheme};package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
}

export function buildPhysicalInvitationResumePath(handoff: string): string {
  if (!isValidPhysicalInvitationHandoff(handoff)) {
    throw new Error('Invalid physical invitation install handoff')
  }
  return `/invite/physical-resume?${new URLSearchParams({ h: handoff }).toString()}`
}
