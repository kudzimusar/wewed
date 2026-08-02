import { redirect } from 'next/navigation'

const DEFAULT_DESTINATION = '/billing'
const LOCAL_ORIGIN = 'https://wewed.local'

type CoupleLoginSearchParams = Promise<{
  next?: string | string[]
}>

function resolveSafeDestination(next: string | string[] | undefined): string {
  const requested = Array.isArray(next) ? next[0] : next

  if (!requested) return DEFAULT_DESTINATION

  try {
    const destination = new URL(requested, LOCAL_ORIGIN)

    if (destination.origin !== LOCAL_ORIGIN) return DEFAULT_DESTINATION
    if (!destination.pathname.startsWith('/')) return DEFAULT_DESTINATION
    if (destination.pathname === '/couple/login') return DEFAULT_DESTINATION

    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return DEFAULT_DESTINATION
  }
}

/**
 * Compatibility entry point for legacy couple sign-in links.
 * Authentication is handled by the secure gate on the destination workspace.
 */
export default async function CoupleLoginRoute({
  searchParams,
}: {
  searchParams: CoupleLoginSearchParams
}) {
  const params = await searchParams
  redirect(resolveSafeDestination(params.next))
}
