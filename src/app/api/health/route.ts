import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EXPECTED_SITE_URL = 'https://wewed-nu.vercel.app'

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? ''

  const requiredEnvironment = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    supabaseUrl: Boolean(supabaseUrl),
    supabaseAnonKey: Boolean(supabaseAnonKey),
    siteUrl: Boolean(siteUrl),
  }

  const optionalEnvironment = {
    directUrl: Boolean(process.env.DIRECT_URL),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  }

  const [database, supabaseAuth] = await Promise.all([
    checkDatabase(),
    supabaseUrl && supabaseAnonKey
      ? checkSupabaseAuth(supabaseUrl, supabaseAnonKey)
      : Promise.resolve(false),
  ])

  const siteUrlMatchesProduction = siteUrl === EXPECTED_SITE_URL
  const requiredEnvironmentReady = Object.values(requiredEnvironment).every(Boolean)
  const ok =
    database &&
    supabaseAuth &&
    siteUrlMatchesProduction &&
    requiredEnvironmentReady

  return NextResponse.json(
    {
      ok,
      checks: {
        database,
        supabaseAuth,
        siteUrlMatchesProduction,
        requiredEnvironment,
        optionalEnvironment,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
