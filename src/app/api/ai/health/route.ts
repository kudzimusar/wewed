import { NextResponse } from 'next/server'
import { getAiDiagnostics } from '@/lib/ai'

export const dynamic = 'force-dynamic'

/**
 * Configuration-only health check. It never returns API keys and does not
 * call a provider, so it consumes no AI quota.
 */
export async function GET(): Promise<NextResponse> {
  const diagnostics = getAiDiagnostics()
  const configuredCount = diagnostics.providers.filter(
    (provider) => provider.configured
  ).length
  const ready = diagnostics.enabled && configuredCount > 0

  return NextResponse.json(
    {
      success: ready,
      service: 'wewed AI provider router',
      configuredProviders: configuredCount,
      ...diagnostics,
    },
    {
      status: ready ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
