import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createSupabaseServiceClient,
  findSupabaseAuthUserByEmail,
} from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const REVIEW_EMAIL = 'play-review@wewed.pro'
const PROVISION_TOKEN_SHA256 = 'e1477ab4a2060bf4a6e248cddabdca0d352b8b54ba34e5722909608eb64f589b'

function validProvisionToken(value: string | null): boolean {
  if (!value) return false
  const actual = createHash('sha256').update(value).digest()
  const expected = Buffer.from(PROVISION_TOKEN_SHA256, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

export async function POST(request: NextRequest) {
  if (!validProvisionToken(request.headers.get('x-wewed-provision-token'))) {
    return response({ success: false, error: 'Not found.' }, 404)
  }

  try {
    const body = await request.json() as Record<string, unknown>
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (email !== REVIEW_EMAIL || password.length < 20) {
      return response({ success: false, error: 'Invalid reviewer credentials.' }, 400)
    }

    const supabase = createSupabaseServiceClient()
    let authUser = await findSupabaseAuthUserByEmail(supabase, REVIEW_EMAIL)
    if (authUser) {
      const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
        password,
        email_confirm: true,
        user_metadata: { display_name: 'Wewed Play Reviewer', wewed_play_review: true },
      })
      if (error || !data.user) throw error ?? new Error('Unable to update reviewer identity.')
      authUser = data.user
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: REVIEW_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { display_name: 'Wewed Play Reviewer', wewed_play_review: true },
      })
      if (error || !data.user) throw error ?? new Error('Unable to create reviewer identity.')
      authUser = data.user
    }

    const coupleId = 'play-review-couple'
    const weddingId = 'play-review-wedding'
    const existingAccessUser = await db.user.findUnique({ where: { email: REVIEW_EMAIL } })
    const accessUserId = existingAccessUser?.id ?? 'play-review-user'

    await db.$transaction(async (transaction) => {
      await transaction.couple.upsert({
        where: { id: coupleId },
        create: {
          id: coupleId,
          slug: 'play-review-couple',
          partner1: 'Tariro',
          partner2: 'Tendai',
          surname: 'Moyo',
          userId: accessUserId,
          subscriptionStatus: 'free',
        },
        update: { userId: accessUserId, subscriptionStatus: 'free' },
      })

      await transaction.wedding.upsert({
        where: { id: weddingId },
        create: {
          id: weddingId,
          slug: 'play-review-wedding',
          title: 'Tariro & Tendai',
          monogram: 'T&T',
          tagline: 'A joyful Zimbabwean celebration',
          date: new Date('2027-12-11T12:00:00.000Z'),
          venue: 'Harare Gardens',
          venueCity: 'Harare',
          venueCountry: 'Zimbabwe',
          privacy: 'private',
          subscriptionTier: 'free',
          coupleId,
        },
        update: {
          title: 'Tariro & Tendai',
          date: new Date('2027-12-11T12:00:00.000Z'),
          privacy: 'private',
          subscriptionTier: 'free',
        },
      })

      await transaction.user.upsert({
        where: { id: accessUserId },
        create: {
          id: accessUserId,
          email: REVIEW_EMAIL,
          name: 'Wewed Play Reviewer',
          role: 'couple',
          coupleId,
          currentWeddingId: weddingId,
          isActive: true,
        },
        update: {
          name: 'Wewed Play Reviewer',
          role: 'couple',
          coupleId,
          currentWeddingId: weddingId,
          isActive: true,
        },
      })

      await transaction.userProfile.upsert({
        where: { id: authUser.id },
        create: {
          id: authUser.id,
          email: REVIEW_EMAIL,
          displayName: 'Wewed Play Reviewer',
          role: 'couple',
          coupleId,
          marketingEmails: false,
        },
        update: {
          email: REVIEW_EMAIL,
          displayName: 'Wewed Play Reviewer',
          role: 'couple',
          coupleId,
          isBanned: false,
          bannedAt: null,
          banReason: null,
          marketingEmails: false,
        },
      })

      await transaction.weddingMembership.upsert({
        where: { userId_weddingId: { userId: accessUserId, weddingId } },
        create: {
          id: 'play-review-membership',
          userId: accessUserId,
          weddingId,
          role: 'owner',
          status: 'active',
          permissions: 'full_access',
          acceptedAt: new Date(),
        },
        update: {
          role: 'owner',
          status: 'active',
          permissions: 'full_access',
          revokedAt: null,
          acceptedAt: new Date(),
        },
      })
    })

    return response({ success: true })
  } catch (error) {
    console.error('[play-review-provision] failed:', error)
    return response({ success: false, error: 'Unable to provision reviewer access.' }, 500)
  }
}
