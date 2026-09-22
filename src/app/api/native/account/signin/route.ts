import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { createNativeAccountSessionToken } from '@/lib/native-account-session'

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}

/**
 * Native account sign-in — master plan Phase 5.
 *
 * Verifies email/password against Supabase directly. It does NOT delegate to the browser sign-in
 * route: that route treats a flat `role` and a single selected wedding as authority and performs
 * account-graph writes, which is exactly what Phase 5 must not inherit.
 *
 * This endpoint issues only the narrow identity session (`native-account-session.ts`) and performs
 * no other write: no pending-membership acceptance, no `currentWeddingId` mutation, no profile
 * upsert, no login-timestamp update. Workspace authority is resolved separately, read-only, by
 * the authority endpoint — never here.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    return noStore({ success: false, error: 'Email and password are required.' }, 400)
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user || !data.user.email) {
    return noStore({ success: false, error: 'Invalid email or password.' }, 401)
  }

  // Read-only lookup of the matching Wewed access user by the now Supabase-verified email. This
  // never creates, activates or repairs an account. An unmatched or inactive account fails closed
  // with the same generic message as a bad password, so this endpoint reveals nothing extra about
  // which accounts exist (the authority endpoint separately reports the exact denial reason once a
  // session exists, per WewedProductionAuthorityV1's own fail-closed `accountStatus`).
  const accessUser = await db.user.findUnique({
    where: { email: data.user.email.toLowerCase() },
    select: { id: true, isActive: true },
  })

  if (!accessUser || !accessUser.isActive) {
    return noStore({ success: false, error: 'Invalid email or password.' }, 401)
  }

  const sessionToken = createNativeAccountSessionToken({
    accessUserId: accessUser.id,
    authUserId: data.user.id,
    email: data.user.email.toLowerCase(),
  })

  return noStore({ success: true, sessionToken })
}
