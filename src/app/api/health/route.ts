import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evaluateHealthEnvironment } from '@/lib/planner-stage9'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function checkDatabase() {
  try {
    const rows = await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`
    return rows[0]?.ok === 1
  } catch (error) {
    console.error('[health] Database check failed:', error)
    return false
  }
}

async function checkSupabaseAuth(url: string, anonKey: string) {
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: 'no-store',
    })

    return response.ok
  } catch (error) {
    console.error('[health] Supabase Auth check failed:', error)
    return false
  }
}

export async function GET() {
  const e2eMode = process.env.WEWED_E2E_MODE === '1'
  const environment = evaluateHealthEnvironment({
    // The browser release gate runs the production build against local fixture
    // infrastructure. Treat only that explicit local-only mode as non-production;
    // deployed production health checks retain the strict HTTPS/origin contract.
    nodeEnv: e2eMode ? 'test' : process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    // App-session signing supports a dedicated secret first and a server-only,
    // high-entropy service-role fallback. Health must validate the same contract.
    sessionSecret: process.env.WEWED_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    productionSiteUrl: process.env.PRODUCTION_SITE_URL,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
  const [database, supabaseAuth] = await Promise.all([
    checkDatabase(),
    e2eMode
      ? Promise.resolve(true)
      : supabaseUrl && supabaseAnonKey
        ? checkSupabaseAuth(supabaseUrl, supabaseAnonKey)
        : Promise.resolve(false),
  ])

  const ok =
    database &&
    supabaseAuth &&
    environment.siteUrlValid &&
    environment.productionSiteMatches &&
    environment.requiredEnvironmentReady

  return NextResponse.json(
    {
      ok,
      checks: {
        database,
        supabaseAuth,
        siteUrlValid: environment.siteUrlValid,
        productionSiteMatches: environment.productionSiteMatches,
        requiredEnvironment: environment.requiredEnvironment,
        optionalEnvironment: environment.optionalEnvironment,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  )
}
