import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  APP_SESSION_COOKIE,
  createAppSessionToken,
  type DashboardRole,
} from '@/lib/app-session'

const RELEASE_SMOKE_TOKEN = '6b4156ba8af646bbb0c0f908e424c513'
const MODULE_PATHS = [
  '/api/planner/tasks',
  '/api/planner/budget',
  '/api/planner/guests',
  '/api/planner/vendors',
  '/api/planner/timeline',
  '/api/planner/seating',
] as const

interface SmokePrincipal {
  userId: string
  email: string
  role: DashboardRole
  coupleId: string | null
  weddingId: string
}

export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== 'production' ||
    request.nextUrl.searchParams.get('token') !== RELEASE_SMOKE_TOKEN
  ) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const principals = await db.$queryRawUnsafe<SmokePrincipal[]>(`
    SELECT
      u.id AS "userId",
      u.email,
      u.role,
      u."coupleId",
      m."weddingId"
    FROM public."User" u
    JOIN public."WeddingMembership" m ON m."userId" = u.id
    WHERE u."isActive" = true
      AND u.role IN ('planner', 'couple')
      AND m.status = 'active'
    ORDER BY CASE WHEN u.role = 'planner' THEN 0 ELSE 1 END, m."createdAt" ASC
    LIMIT 1
  `)

  const principal = principals[0]
  if (!principal) {
    return NextResponse.json(
      { success: false, error: 'No active planner principal is available.' },
      { status: 503 },
    )
  }

  const session = createAppSessionToken({
    userId: principal.userId,
    authUserId: principal.userId,
    email: principal.email.toLowerCase(),
    role: principal.role,
    coupleId: principal.coupleId,
    activeWeddingId: principal.weddingId,
  })
  const headers = { cookie: `${APP_SESSION_COOKIE}=${session}` }
  const origin = request.nextUrl.origin

  const results = await Promise.all(
    MODULE_PATHS.map(async (path) => {
      const response = await fetch(`${origin}${path}`, {
        headers,
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => null)) as
        | { data?: unknown[] }
        | null
      return {
        path,
        status: response.status,
        rows: Array.isArray(payload?.data) ? payload.data.length : null,
      }
    }),
  )

  const success = results.every((result) => result.status === 200)
  return NextResponse.json(
    {
      success,
      authenticated: true,
      weddingScoped: true,
      results,
    },
    {
      status: success ? 200 : 500,
      headers: { 'cache-control': 'no-store' },
    },
  )
}
