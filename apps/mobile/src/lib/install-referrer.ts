export const MAX_INSTALL_REFERRER_ATTEMPTS = 3
const MAX_INSTALL_REFERRER_LENGTH = 2048
const INVITATION_HANDOFF_PATTERN = /^[A-Za-z0-9_-]{43}$/

export interface InstallReferrerState {
  processed: boolean
  attempts: number
}

const EMPTY_STATE: InstallReferrerState = { processed: false, attempts: 0 }

function handoffFromQuery(value: string): string | null {
  const questionMark = value.indexOf('?')
  const query = (questionMark >= 0 ? value.slice(questionMark + 1) : value).replace(/^\?/, '')
  const values = new URLSearchParams(query).getAll('handoff')
  if (values.length !== 1) return null
  const candidate = values[0]?.trim() ?? ''
  return INVITATION_HANDOFF_PATTERN.test(candidate) ? candidate : null
}

export function parseInvitationHandoffReferrer(rawReferrer: string | null | undefined): string | null {
  if (typeof rawReferrer !== 'string') return null
  const referrer = rawReferrer.trim()
  if (!referrer || referrer.length > MAX_INSTALL_REFERRER_LENGTH) return null

  const direct = handoffFromQuery(referrer)
  if (direct) return direct

  try {
    const decoded = decodeURIComponent(referrer)
    if (decoded === referrer) return null
    return handoffFromQuery(decoded)
  } catch {
    return null
  }
}

export function buildInvitationResumeUrl(handoff: string): string {
  if (!INVITATION_HANDOFF_PATTERN.test(handoff)) {
    throw new Error('Invalid Wewed invitation handoff')
  }
  return `https://wewed.pro/invite/resume?${new URLSearchParams({ h: handoff }).toString()}`
}

export function hasExplicitWewedLaunchIntent(initialUrl: string | null | undefined): boolean {
  if (!initialUrl) return false
  try {
    const url = new URL(initialUrl)
    if (url.protocol === 'wewed:') return true
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return host === 'wewed.pro' || host === 'www.wewed.pro'
  } catch {
    return false
  }
}

export function parseInstallReferrerState(raw: string | null | undefined): InstallReferrerState {
  if (!raw) return { ...EMPTY_STATE }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const attemptsValue = typeof parsed.attempts === 'number' && Number.isFinite(parsed.attempts)
      ? Math.trunc(parsed.attempts)
      : 0
    return {
      processed: parsed.processed === true,
      attempts: Math.min(MAX_INSTALL_REFERRER_ATTEMPTS, Math.max(0, attemptsValue)),
    }
  } catch {
    return { ...EMPTY_STATE }
  }
}

export function serializeInstallReferrerState(state: InstallReferrerState): string {
  return JSON.stringify({
    processed: state.processed === true,
    attempts: Math.min(MAX_INSTALL_REFERRER_ATTEMPTS, Math.max(0, Math.trunc(state.attempts))),
  })
}
