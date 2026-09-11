const LOOPBACK_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export const LOCAL_CI_E2E_PLANNER = {
  id: 'e2e-planner-user',
  authUserId: 'e2e-supabase-auth-user',
  email: 'planner.e2e@example.test',
  name: 'Planner E2E',
  password: 'wewed-native-e2e-ci-only',
} as const

export function isSafeLocalCiE2EEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (
    env.WEWED_E2E_MODE !== '1' ||
    env.CI !== 'true' ||
    Boolean(env.VERCEL)
  ) {
    return false
  }

  const databaseUrl = env.DATABASE_URL?.trim()
  if (!databaseUrl) return false

  try {
    const parsed = new URL(databaseUrl)
    const postgresProtocol = parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:'
    return postgresProtocol && LOOPBACK_DATABASE_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export function assertSafeLocalCiE2EEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isSafeLocalCiE2EEnvironment(env)) {
    throw new Error(
      'Refusing Wewed E2E authority outside explicit CI mode on a loopback PostgreSQL database.',
    )
  }
}
