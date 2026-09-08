export const GOOGLE_PLAY_DISTRIBUTION_COOKIE = 'wewed_distribution'
export const GOOGLE_PLAY_DISTRIBUTION_VALUE = 'google-play'

export function isGooglePlayDistributionValue(value: string | null | undefined): boolean {
  return value === GOOGLE_PLAY_DISTRIBUTION_VALUE
}

export function browserUsesGooglePlayDistribution(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .some((entry) => entry === `${GOOGLE_PLAY_DISTRIBUTION_COOKIE}=${GOOGLE_PLAY_DISTRIBUTION_VALUE}`)
}
