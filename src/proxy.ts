import { NextRequest, NextResponse } from 'next/server'
import {
  APP_SESSION_COOKIE,
  verifyAppSessionToken,
} from '@/lib/app-session'

function requiresDashboardSession(request: NextRequest): boolean {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/planner/')) return true
  if (pathname === '/api/planner') return true
  if (pathname === '/api/seed') return true

  if (pathname === '/api/rsvp' && request.method === 'GET') return true

  if (
    pathname.startsWith('/api/rsvp/') &&
    request.method === 'PATCH'
  ) {
    return true
  }

  return false
}

export function proxy(request: NextRequest) {
  if (!requiresDashboardSession(request)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(APP_SESSION_COOKIE)?.value
  const session = token ? verifyAppSessionToken(token) : null

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — sign in is required' },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/planner/:path*',
    '/api/rsvp',
    '/api/rsvp/:path*',
    '/api/seed',
  ],
}
