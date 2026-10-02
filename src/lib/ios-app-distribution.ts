import 'server-only'

const ALLOWED_IOS_DISTRIBUTION_HOSTS = new Set([
  'apps.apple.com',
  'testflight.apple.com',
])

export function configuredIosDistributionUrl(
  value: string | undefined = process.env.WEWED_IOS_DISTRIBUTION_URL,
): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || !ALLOWED_IOS_DISTRIBUTION_HOSTS.has(url.hostname)) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}
