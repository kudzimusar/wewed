import { NextRequest, NextResponse } from 'next/server'
import {
  APP_SESSION_COOKIE,
  verifyAppSessionToken,
} from '@/lib/app-session'

function privateNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function isGuestWeddingSessionRoute(pathname: string): boolean {
  return /^\/api\/weddings\/[^/]+\/guest-session(?:\/exchange)?$/.test(
    pathname,
  )
}

function isProtectedPlannerPage(pathname: string): boolean {
  return pathname === '/planner/ai-workspace' || pathname === '/planner/wedding-brief'
}

function requiresDashboardSession(request: NextRequest): boolean {
  const { pathname } = request.nextUrl

  if (isProtectedPlannerPage(pathname)) return true
  if (pathname.startsWith('/api/planner/')) return true
  if (pathname === '/api/planner') return true
  if (pathname === '/api/seed') return true
  if (pathname === '/api/auth/wedding') return true

  // Invitation QR exchange and guest-session self-service authenticate with
  // the signed wedding guest cookie, not the dashboard application cookie.
  if (isGuestWeddingSessionRoute(pathname)) return false
  if (pathname.startsWith('/api/weddings/')) return true

  if (pathname === '/api/rsvp' && request.method === 'GET') return true

  if (pathname.startsWith('/api/rsvp/') && request.method === 'PATCH') {
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
    if (isProtectedPlannerPage(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/planner'
      url.searchParams.set('signin', 'required')
      return privateNoStore(NextResponse.redirect(url))
    }
    return privateNoStore(
      NextResponse.json(
        { success: false, error: 'Unauthorized — sign in is required' },
        { status: 401 },
      ),
    )
  }

  return privateNoStore(NextResponse.next())
}

export const config = {
  matcher: [
    '/planner/ai-workspace',
    '/planner/wedding-brief',
    '/api/planner/:path*',
    '/api/rsvp',
    '/api/rsvp/:path*',
    '/api/seed',
    '/api/auth/wedding',
    '/api/weddings/:path*',
  ],
}
