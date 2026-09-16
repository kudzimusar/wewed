import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BRANCH = 'feature/private-invitation-android-delivery-20260912'
const WEDDING_ID = 'wewed-pr202-uat-20260912'
const WEDDING_TITLE = 'Wewed PR 202 — Synthetic UAT'
const REQUIRED_STYLE = 'ivory-floral-gold'

const DROP_OLD_STYLE_CONSTRAINT_SQL = `
ALTER TABLE "Wedding"
  DROP CONSTRAINT IF EXISTS "Wedding_invitationCardStyle_check"
`

const ADD_PREMIUM_STYLE_CONSTRAINT_SQL = `
ALTER TABLE "Wedding"
  ADD CONSTRAINT "Wedding_invitationCardStyle_check"
  CHECK (
    "invitationCardStyle" IN (
      'ivory-floral-gold',
      'botanical',
      'editorial',
      'midnight',
      'royal-emerald',
      'classic-white',
      'blush-romance',
      'african-luxe',
      'black-tie',
      'watercolour-garden',
      'sunset-terracotta',
      'celestial'
    )
  )
`

/**
 * Temporary PR #202 preview-only fixture repair.
 * Applies the repository's existing premium invitation style constraint and
 * updates only the synthetic UAT wedding's persisted invitation style.
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

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(DROP_OLD_STYLE_CONSTRAINT_SQL)
    await tx.$executeRawUnsafe(ADD_PREMIUM_STYLE_CONSTRAINT_SQL)
  })

  const after = await db.wedding.update({
    where: { id: WEDDING_ID },
    data: { invitationCardStyle: REQUIRED_STYLE },
    select: { id: true, invitationCardStyle: true },
  })

  return NextResponse.json({
    success: true,
    before: { invitationCardStyle: before.invitationCardStyle },
    after: { invitationCardStyle: after.invitationCardStyle },
    premiumStyleConstraintApplied: true,
  })
}
