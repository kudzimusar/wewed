import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'

const VERIFICATION_METHODS = new Set([
  'domain_email',
  'business_phone',
  'social_account',
  'registration_document',
  'manual_review',
])

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function email(value: unknown): string {
  const normalized = text(value, 180).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : ''
}

function optionalHttpsUrl(value: unknown): string | null {
  const normalized = text(value, 1000)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const session = readAppSession(request)

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ success: false, error: 'Invalid claim request.' }, { status: 400 })
    }

    const claimantName = text(body.claimantName, 160)
    const claimantEmail = email(body.claimantEmail)
    const claimantPhone = text(body.claimantPhone, 80) || null
    const relationship = text(body.relationship, 120)
    const verificationMethod = text(body.verificationMethod, 80)
    const evidenceUrl = optionalHttpsUrl(body.evidenceUrl)
    const message = text(body.message, 2000) || null
    const declarationAccepted = body.declarationAccepted === true

    if (!claimantName || !claimantEmail || !relationship) {
      return NextResponse.json(
        { success: false, error: 'Name, valid email address and relationship to the business are required.' },
        { status: 400 },
      )
    }
    if (!VERIFICATION_METHODS.has(verificationMethod)) {
      return NextResponse.json(
        { success: false, error: 'Select a supported ownership verification method.' },
        { status: 400 },
      )
    }
    if (!declarationAccepted) {
      return NextResponse.json(
        { success: false, error: 'You must confirm that you are authorised to represent the business.' },
        { status: 400 },
      )
    }
    if (body.evidenceUrl && !evidenceUrl) {
      return NextResponse.json(
        { success: false, error: 'Evidence link must be a valid HTTPS URL.' },
        { status: 400 },
      )
    }

    const profiles = await db.$queryRawUnsafe<Array<{
      profileId: string
      businessAccountId: string
      displayName: string
      listingStatus: string
      isClaimable: boolean
    }>>(
      `SELECT
         p.id AS "profileId",
         p."businessAccountId",
         p."displayName",
         p."listingStatus",
         p."isClaimable"
       FROM wewed_admin."ProviderProfile" p
       JOIN wewed_admin."BusinessAccount" ba ON ba.id = p."businessAccountId"
       WHERE p.slug = $1
         AND p.visibility = 'published'
         AND ba.status = 'active'
       LIMIT 1`,
      slug,
    )
    const profile = profiles[0]

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Business listing not found.' }, { status: 404 })
    }
    if (!profile.isClaimable || !['unclaimed', 'claim_pending'].includes(profile.listingStatus)) {
      return NextResponse.json(
        { success: false, error: 'This business listing is not available to claim.' },
        { status: 409 },
      )
    }

    const claimId = `provider-claim-${randomUUID()}`
    const submission = await db.$transaction(async (transaction) => {
      const lockedProfiles = await transaction.$queryRawUnsafe<Array<{
        listingStatus: string
        isClaimable: boolean
      }>>(
        `SELECT "listingStatus", "isClaimable"
         FROM wewed_admin."ProviderProfile"
         WHERE id = $1
         FOR UPDATE`,
        profile.profileId,
      )
      const lockedProfile = lockedProfiles[0]
      if (
        !lockedProfile ||
        !lockedProfile.isClaimable ||
        !['unclaimed', 'claim_pending'].includes(lockedProfile.listingStatus)
      ) {
        return { type: 'unavailable' as const }
      }

      const openClaims = await transaction.$queryRawUnsafe<Array<{ id: string; status: string }>>(
        `SELECT id, status
         FROM wewed_admin."ProviderClaimRequest"
         WHERE "providerProfileId" = $1
           AND lower("claimantEmail") = lower($2)
           AND status IN ('pending', 'verification_required')
         LIMIT 1`,
        profile.profileId,
        claimantEmail,
      )
      if (openClaims[0]) {
        return {
          type: 'duplicate' as const,
          id: openClaims[0].id,
          status: openClaims[0].status,
        }
      }

      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."ProviderClaimRequest" (
           id, "providerProfileId", "businessAccountId", "claimantUserId",
           "claimantName", "claimantEmail", "claimantPhone", relationship,
           "verificationMethod", "evidenceUrl", message, "declarationAccepted",
           status, "verificationEvidence", "createdAt", "updatedAt"
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true,
           'pending', $12::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )`,
        claimId,
        profile.profileId,
        profile.businessAccountId,
        session?.userId ?? null,
        claimantName,
        claimantEmail,
        claimantPhone,
        relationship,
        verificationMethod,
        evidenceUrl,
        message,
        JSON.stringify({ submittedFrom: 'public_provider_profile' }),
      )

      await transaction.$executeRawUnsafe(
        `UPDATE wewed_admin."ProviderProfile"
         SET "listingStatus" = 'claim_pending',
             "claimNotice" = 'An ownership claim is being reviewed by Wewed.',
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1 AND "isClaimable" = true
           AND "listingStatus" IN ('unclaimed', 'claim_pending')`,
        profile.profileId,
      )

      return { type: 'created' as const }
    })

    if (submission.type === 'unavailable') {
      return NextResponse.json(
        { success: false, error: 'This business listing is no longer available to claim.' },
        { status: 409 },
      )
    }
    if (submission.type === 'duplicate') {
      return NextResponse.json({
        success: true,
        duplicate: true,
        reference: submission.id,
        status: submission.status,
        message: 'Your existing claim is already in the Wewed review queue.',
      })
    }

    return NextResponse.json(
      {
        success: true,
        reference: claimId,
        status: 'pending',
        businessName: profile.displayName,
        message: 'Claim submitted. Wewed will verify your relationship to the business before granting access.',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[providers/claims] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to submit the business claim.' },
      { status: 500 },
    )
  }
}
