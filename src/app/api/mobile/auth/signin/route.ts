import { NextRequest, NextResponse } from 'next/server'
import { POST as browserSignIn } from '@/app/api/auth/signin/route'
import { APP_SESSION_COOKIE } from '@/lib/app-session'

export async function POST(request: NextRequest) {
  const response = await browserSignIn(request)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return NextResponse.json(
      payload ?? { success: false, error: 'Sign in failed.' },
      { status: response.status, headers: { 'cache-control': 'no-store' } },
    )
  }

  const sessionToken = response.cookies.get(APP_SESSION_COOKIE)?.value
  if (!sessionToken) {
    console.error('[wewed mobile auth] browser sign-in succeeded without application session')
    return NextResponse.json(
      { success: false, error: 'Secure mobile session could not be created.' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    )
  }

  return NextResponse.json(
    {
      ...payload,
      sessionToken,
      sessionTransport: 'bearer',
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
