import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BRANCH = 'feature/private-invitation-android-delivery-20260912'
const WEDDING_ID = 'wewed-pr202-uat-20260912'
const WEDDING_TITLE = 'Wewed PR 202 — Synthetic UAT'
const REQUIRED_STYLE = 'ivory-floral-gold'

/**
 * Temporary PR #202 preview-only fixture repair.
 * Updates only the synthetic UAT wedding's persisted invitation style.
 */
export async function GET() {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== BRANCH
  ) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const before = await db.wedding.findUnique({
    where: { id: WEDDING_ID },
    select: { id: true, slug: true, title: true, invitationCardStyle: true },
  })

  if (
    !before ||
    before.slug !== WEDDING_ID ||
    before.title !== WEDDING_TITLE
  ) {
    return NextResponse.json(
      { success: false, error: 'Synthetic PR #202 UAT wedding not found.' },
      { status: 409 },
    )
  }

  const after = await db.wedding.update({
    where: { id: WEDDING_ID },
    data: { invitationCardStyle: REQUIRED_STYLE },
    select: { id: true, invitationCardStyle: true },
  })

  return NextResponse.json({
    success: true,
    before: { invitationCardStyle: before.invitationCardStyle },
    after: { invitationCardStyle: after.invitationCardStyle },
  })
}
