import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BRANCH = 'feature/private-invitation-android-delivery-20260912'
const WEDDING_ID = 'wewed-pr202-uat-20260912'
const PLANNER_EMAIL = 'eleven.eleven.testing@gmail.com'
const NONCE = 'UZ2IOPnIDo7ux8D0ck0nqspiOnRZh_sd'

function blocked(message: string, status = 404) {
  return NextResponse.json({ success: false, error: message }, { status })
}

/**
 * Temporary PR #202 UAT-only helper. It binds one existing testing identity to the
 * synthetic PR #202 wedding so a human can qualify Planner contribution governance.
 * Remove immediately after the one-time binding has succeeded.
 */
export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== BRANCH ||
    request.nextUrl.searchParams.get('nonce') !== NONCE
  ) {
    return blocked('Not found.')
  }

  const wedding = await db.wedding.findUnique({
    where: { id: WEDDING_ID },
    select: { id: true, slug: true, title: true },
  })

  if (
    !wedding ||
    wedding.slug !== WEDDING_ID ||
    wedding.title !== 'Wewed PR 202 — Synthetic UAT'
  ) {
    return blocked('Synthetic UAT wedding is not provisioned.', 409)
  }

  const now = new Date()
  const user = await db.user.upsert({
    where: { email: PLANNER_EMAIL },
    create: {
      email: PLANNER_EMAIL,
      name: 'Eleven Eleven Testing',
      role: 'planner',
      currentWeddingId: WEDDING_ID,
      isActive: true,
    },
    update: {
      role: 'planner',
      currentWeddingId: WEDDING_ID,
      isActive: true,
    },
    select: { id: true, email: true, role: true, currentWeddingId: true },
  })

  const membership = await db.weddingMembership.upsert({
    where: {
      userId_weddingId: {
        userId: user.id,
        weddingId: WEDDING_ID,
      },
    },
    create: {
      userId: user.id,
      weddingId: WEDDING_ID,
      role: 'planner',
      status: 'active',
      acceptedAt: now,
    },
    update: {
      role: 'planner',
      status: 'active',
      acceptedAt: now,
      revokedAt: null,
    },
    select: { id: true, role: true, status: true, weddingId: true },
  })

  return NextResponse.json({
    success: true,
    user,
    membership,
    wedding: { id: wedding.id, slug: wedding.slug },
  })
}
