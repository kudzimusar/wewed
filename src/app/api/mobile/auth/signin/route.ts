import { NextRequest, NextResponse } from 'next/server'
import { POST as browserSignIn } from '@/app/api/auth/signin/route'
import {
  APP_SESSION_COOKIE,
  createAppSessionToken,
} from '@/lib/app-session'
import { db } from '@/lib/db'
import {
  LOCAL_CI_E2E_PLANNER,
  isSafeLocalCiE2EEnvironment,
} from '@/lib/e2e-environment'

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

async function localCiE2ESignIn(request: NextRequest): Promise<NextResponse | null> {
  if (!isSafeLocalCiE2EEnvironment()) return null

  const body = await request.clone().json().catch(() => null) as {
    email?: unknown
    password?: unknown
  } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (
    email !== LOCAL_CI_E2E_PLANNER.email ||
    password !== LOCAL_CI_E2E_PLANNER.password
  ) {
    return noStoreJson({ success: false, error: 'Invalid email or password.' }, 401)
  }

  const accessUser = await db.user.findUnique({
    where: { id: LOCAL_CI_E2E_PLANNER.id },
    select: {
      id: true,
      email: true,
      role: true,
      coupleId: true,
      currentWeddingId: true,
      isActive: true,
    },
  })

  if (
    !accessUser ||
    !accessUser.isActive ||
    accessUser.role !== 'planner' ||
    accessUser.email.toLowerCase() !== LOCAL_CI_E2E_PLANNER.email ||
    !accessUser.currentWeddingId
  ) {
    return noStoreJson({
      success: false,
      error: 'The local CI planner fixture is not ready.',
    }, 503)
  }

  const activeMembership = await db.weddingMembership.findFirst({
    where: {
      userId: accessUser.id,
      weddingId: accessUser.currentWeddingId,
      status: 'active',
    },
    select: { id: true },
  })

  if (!activeMembership) {
    return noStoreJson({
      success: false,
      error: 'The local CI planner fixture is missing its active wedding membership.',
    }, 503)
  }

  const sessionToken = createAppSessionToken({
    userId: accessUser.id,
    authUserId: LOCAL_CI_E2E_PLANNER.authUserId,
    email: accessUser.email,
    role: 'planner',
    coupleId: accessUser.coupleId,
    activeWeddingId: accessUser.currentWeddingId,
  })

  return noStoreJson({
    success: true,
    sessionToken,
    sessionTransport: 'bearer',
    workspace: 'wedding',
  })
}

export async function POST(request: NextRequest) {
  const e2eResponse = await localCiE2ESignIn(request)
  if (e2eResponse) return e2eResponse

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
