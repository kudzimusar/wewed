import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import {
  GOOGLE_PLAY_DISTRIBUTION_COOKIE,
  GOOGLE_PLAY_DISTRIBUTION_VALUE,
} from '@/lib/google-play-distribution'

const WORKSPACE_BY_ROLE = {
  admin: '/admin',
  couple: '/couple',
  planner: '/planner',
  vendor: '/vendor',
} as const

export function GET(request: NextRequest) {
  const session = readAppSession(request)
  const destination = session ? WORKSPACE_BY_ROLE[session.role] : '/sign-in?from=app'
  const response = NextResponse.redirect(new URL(destination, request.url))

  if (request.nextUrl.searchParams.get('source') === GOOGLE_PLAY_DISTRIBUTION_VALUE) {
    response.cookies.set(GOOGLE_PLAY_DISTRIBUTION_COOKIE, GOOGLE_PLAY_DISTRIBUTION_VALUE, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    })
  }

  return response
}
