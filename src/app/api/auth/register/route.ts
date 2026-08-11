import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { registrationReceivedEmail } from '@/lib/email/templates'
import { sendTransactionalEmail } from '@/lib/email/resend'
import { PROVIDER_CATEGORY_VALUES } from '@/lib/provider-catalog'
import { publicUrl } from '@/lib/public-origin'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const ACCOUNT_TYPES = new Set(['planning_company', 'couple', 'venue', 'vendor', 'client'])
const REQUESTED_ROLES = new Set(['business_owner', 'planner', 'coordinator', 'couple_owner', 'venue_manager', 'vendor_manager', 'viewer'])
const PLANS = new Set(['free', 'starter', 'professional', 'enterprise'])
const attempts = new Map<string, { count: number; resetAt: number }>()

type ReservedVendorRow = {
  accountId: string
  businessName: string
  profileId: string
  profileSlug: string
}

function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function stringList(value: unknown, limit = 8): string[] {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return Array.from(new Set(source.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))).slice(0, limit)
}

function safeHttpsUrl(value: unknown): string | null {
  const normalized = text(value, 500)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    if (url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'wewed-applicant'
}

function clientKey(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function isRateLimited(request: NextRequest): boolean {
  const key = clientKey(request)
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return false
  }
  current.count += 1
  return current.count > 5
}

async function reservedVendorForEmail(email: string): Promise<ReservedVendorRow | null | 'ambiguous'> {
  const rows = await db.$queryRawUnsafe<ReservedVendorRow[]>(
    `SELECT
       ba.id AS "accountId",
       ba.name AS "businessName",
       profile.id AS "profileId",
       profile.slug AS "profileSlug"
     FROM public."BusinessAccount" ba
     JOIN public."ProviderProfile" profile
       ON profile."businessAccountId" = ba.id
      AND profile.visibility = 'published'
      AND profile."listingStatus" IN ('claimed', 'verified')
      AND profile."isClaimable" = false
     WHERE ba.type = 'vendor'
       AND ba.status = 'active'
       AND ba."onboardingStatus" = 'complete'
       AND ba."ownerUserId" IS NULL
       AND lower(COALESCE(ba.metadata->>'reservedOwnerEmail', '')) = $1
     ORDER BY ba."createdAt" ASC, ba.id ASC
     LIMIT 2`,
    email,
  )
  if (rows.length > 1) return 'ambiguous'
  return rows[0] ?? null
}

export async function POST(request: NextRequest) {
  if (isRateLimited(request)) {
    return NextResponse.json({ success: false, error: 'Too many registration attempts. Please try again later.' }, { status: 429 })
  }

  let authUserId: string | null = null

  try {
    const body = (await request.json()) as Record<string, unknown>
    const name = text(body.name, 120)
    const email = text(body.email, 180).toLowerCase()
    const password = typeof body.password === 'string' ? body.password : ''
    const businessName = text(body.businessName, 160)
    const accountType = text(body.accountType, 40)
    const requestedRole = text(body.requestedRole, 60)
    const requestedPlan = text(body.requestedPlan, 40) || 'free'
    const country = text(body.country, 120)
    const city = text(body.city, 120)
    const primaryServiceArea = text(body.primaryServiceArea, 160)
    const phoneCountryCode = text(body.phoneCountryCode, 12)
    const phoneNumber = text(body.phone, 60)
    const phone = phoneNumber ? `${phoneCountryCode && phoneCountryCode !== 'other' ? `${phoneCountryCode} ` : ''}${phoneNumber}`.trim() : ''
    const website = safeHttpsUrl(body.website)
    const socialProfile = safeHttpsUrl(body.socialProfile)
    const registrationNumber = text(body.registrationNumber, 160)
    const notes = text(body.notes, 2000)
    const acceptedTerms = body.acceptedTerms === true
    const requestedServices = stringList(body.requestedServices, 8)
    const requestedService = requestedServices[0] || text(body.requestedService, 80)
    const reservedProfileSlug = text(body.reservedProfileSlug, 100)
    const providerApplication = accountType === 'venue' || accountType === 'vendor'

    if (!name || !email || !businessName || !ACCOUNT_TYPES.has(accountType)) {
      return NextResponse.json({ success: false, error: 'Name, email, account type and account or wedding name are required.' }, { status: 400 })
    }
    if (!REQUESTED_ROLES.has(requestedRole)) return NextResponse.json({ success: false, error: 'Requested role is invalid.' }, { status: 400 })
    if (!PLANS.has(requestedPlan)) return NextResponse.json({ success: false, error: 'Requested plan is invalid.' }, { status: 400 })
    if (password.length < 12) return NextResponse.json({ success: false, error: 'Use a password with at least 12 characters.' }, { status: 400 })
    if (!acceptedTerms) return NextResponse.json({ success: false, error: 'You must accept the registration terms.' }, { status: 400 })

    const reservedVendor = await reservedVendorForEmail(email)
    if (reservedVendor === 'ambiguous') {
      return NextResponse.json({ success: false, error: 'This email is reserved for more than one Vendor profile. Wewed support must reconcile the reservation before registration.' }, { status: 409 })
    }

    if (reservedVendor) {
      if (accountType !== 'vendor') {
        return NextResponse.json({ success: false, error: 'This email is reserved for an approved Wewed Vendor profile. Use the Vendor owner activation link.' }, { status: 409 })
      }
      if (!reservedProfileSlug || reservedProfileSlug !== reservedVendor.profileSlug) {
        return NextResponse.json({ success: false, error: 'This email is reserved for an existing Vendor profile. Open that profile’s secure owner activation link instead of creating a new application.' }, { status: 409 })
      }
      if (businessName.toLocaleLowerCase() !== reservedVendor.businessName.toLocaleLowerCase()) {
        return NextResponse.json({ success: false, error: `This login is reserved for ${reservedVendor.businessName}. Keep the approved business name unchanged.` }, { status: 409 })
      }
      if (requestedRole !== 'business_owner') {
        return NextResponse.json({ success: false, error: 'Reserved Vendor activation must be completed by the business owner.' }, { status: 400 })
      }
    } else if (reservedProfileSlug) {
      return NextResponse.json({ success: false, error: 'The reserved Vendor profile is not available for this email. Check the reserved owner email before continuing.' }, { status: 409 })
    }

    if (providerApplication && !reservedVendor) {
      if (!country || !city || !primaryServiceArea) {
        return NextResponse.json({ success: false, error: 'Country, city and primary service area are required for provider applications.' }, { status: 400 })
      }
      if (requestedServices.length === 0 || requestedServices.some((service) => !PROVIDER_CATEGORY_VALUES.has(service))) {
        return NextResponse.json({ success: false, error: 'Select at least one valid wedding service.' }, { status: 400 })
      }
      if (accountType === 'venue' && (requestedServices.length !== 1 || requestedServices[0] !== 'venue')) {
        return NextResponse.json({ success: false, error: 'Venue applications must use the venue service category.' }, { status: 400 })
      }
      if ((body.website && !website) || (body.socialProfile && !socialProfile)) {
        return NextResponse.json({ success: false, error: 'Website and social profile links must be valid HTTPS URLs.' }, { status: 400 })
      }
    }

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return NextResponse.json({ success: false, error: 'An application or account already exists for this email.' }, { status: 409 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    if (!supabaseUrl || !anonKey) throw new Error('Supabase public authentication is not configured.')

    const supabase = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: publicUrl(reservedVendor ? '/register?confirmed=vendor' : '/register?confirmed=1'),
        data: {
          display_name: name,
          wewed_application: true,
          requested_account_type: accountType,
          requested_service: requestedService || null,
          requested_services: requestedServices,
          reserved_profile_slug: reservedVendor?.profileSlug ?? null,
        },
      },
    })

    if (error || !data.user || data.user.identities?.length === 0) {
      return NextResponse.json({ success: false, error: 'Unable to create this registration. The email may already be registered.' }, { status: 409 })
    }

    authUserId = data.user.id
    const appUserId = randomUUID()
    const submittedAt = new Date().toISOString()

    if (reservedVendor) {
      const membershipId = `member-${randomUUID()}`
      const attachedMetadata = {
        authUserId,
        applicantName: name,
        applicantEmail: email,
        ownerAccessStatus: 'auth_identity_attached',
        ownerAttachedAt: submittedAt,
        emailConfirmationRequired: !data.session,
      }

      await db.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(
          `INSERT INTO public."User" ("id", "email", "name", "role", "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, 'vendor', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          appUserId,
          email,
          name,
        )
        await transaction.userProfile.create({ data: { id: authUserId as string, email, displayName: reservedVendor.businessName, role: 'vendor' } })

        const attached = await transaction.$executeRawUnsafe(
          `UPDATE public."BusinessAccount"
           SET "ownerUserId" = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1
             AND type = 'vendor'
             AND status = 'active'
             AND "onboardingStatus" = 'complete'
             AND "ownerUserId" IS NULL
             AND lower(COALESCE(metadata->>'reservedOwnerEmail', '')) = $4`,
          reservedVendor.accountId,
          appUserId,
          JSON.stringify(attachedMetadata),
          email,
        )
        if (attached !== 1) {
          throw new Error('The reserved Vendor profile was claimed by another request before this registration completed.')
        }

        await transaction.$executeRawUnsafe(
          `INSERT INTO public."BusinessAccountMember"
            ("id", "businessAccountId", "userId", "role", "status", "permissions", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 'business_owner', 'active', $4::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          membershipId,
          reservedVendor.accountId,
          appUserId,
          JSON.stringify(['account.manage', 'profile.manage', 'enquiries.manage']),
        )

        await transaction.$executeRawUnsafe(
          `UPDATE public."ProviderProfile"
           SET "acceptingEnquiries" = true,
             "claimNotice" = NULL,
             "lastProfileUpdate" = CURRENT_TIMESTAMP,
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1
             AND "businessAccountId" = $2
             AND visibility = 'published'
             AND "listingStatus" IN ('claimed', 'verified')
             AND "isClaimable" = false`,
          reservedVendor.profileId,
          reservedVendor.accountId,
        )

        await transaction.$executeRawUnsafe(
          `INSERT INTO public."BusinessAuditLog"
            ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details", "createdAt")
           VALUES ($1, $2, $3, 'business_account.reserved_vendor_owner_attached', 'BusinessAccount', $3, $4::jsonb, CURRENT_TIMESTAMP)`,
          `audit-${randomUUID()}`,
          appUserId,
          reservedVendor.accountId,
          JSON.stringify({
            authUserId,
            email,
            profileId: reservedVendor.profileId,
            profileSlug: reservedVendor.profileSlug,
            confirmationRequired: !data.session,
            attachedAt: submittedAt,
          }),
        )
      })

      return NextResponse.json({
        success: true,
        applicationId: reservedVendor.accountId,
        confirmationRequired: !data.session,
        reservedProfileAttached: true,
        businessName: reservedVendor.businessName,
        profileSlug: reservedVendor.profileSlug,
        message: data.session
          ? 'Your approved Vendor profile is attached and ready to sign in.'
          : 'Your approved Vendor profile is attached. Confirm your email, then sign in to the Vendor workspace.',
      })
    }

    const accountId = `business-${randomUUID()}`
    const membershipId = `member-${randomUUID()}`
    const businessSlug = `${slugify(businessName)}-${accountId.slice(-8)}`
    const metadata = {
      applicationSource: 'public_registration',
      authUserId,
      applicantName: name,
      applicantEmail: email,
      phone: phone || null,
      country: country || null,
      city: city || null,
      primaryServiceArea: primaryServiceArea || null,
      website,
      socialProfile,
      registrationNumber: registrationNumber || null,
      requestedRole,
      requestedPlan,
      requestedService: requestedService || null,
      requestedServices,
      submittedAt,
      emailConfirmationRequired: !data.session,
      internalOnboardingRequired: true,
    }

    await db.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `INSERT INTO public."User" ("id", "email", "name", "role", "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, 'viewer', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        appUserId,
        email,
        name,
      )
      await transaction.userProfile.create({ data: { id: authUserId as string, email, displayName: name, role: 'viewer' } })
      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAccount" ("id", "name", "slug", "type", "status", "ownerUserId", "sourceType", "sourceId", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "notes", "metadata") VALUES ($1, $2, $3, $4, 'pending_review', $5, 'public_registration', $6, 'not_started', $7, 'free', $8, $9::jsonb)`,
        accountId,
        businessName,
        businessSlug,
        accountType,
        appUserId,
        authUserId,
        requestedPlan,
        notes || null,
        JSON.stringify(metadata),
      )
      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAccountMember" ("id", "businessAccountId", "userId", "role", "status", "permissions") VALUES ($1, $2, $3, $4, 'invited', '[]'::jsonb)`,
        membershipId,
        accountId,
        appUserId,
        requestedRole,
      )
      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAuditLog" ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details") VALUES ($1, NULL, $2, 'business_account.public_application_submitted', 'BusinessAccount', $2, $3::jsonb)`,
        `audit-${randomUUID()}`,
        accountId,
        JSON.stringify({ email, name, accountType, requestedRole, requestedPlan, requestedServices, country, city, primaryServiceArea, submittedAt }),
      )

      if (providerApplication) {
        await transaction.$executeRawUnsafe(
          `INSERT INTO wewed_admin."ProviderProfile" ("id", "businessAccountId", "slug", "displayName", "country", "city", "serviceAreas", "publicEmail", "phone", "website", "socialLinks", "visibility", "completionScore") VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::jsonb, 'draft', 25)`,
          `provider-profile-${randomUUID()}`,
          accountId,
          businessSlug,
          businessName,
          country,
          city,
          JSON.stringify([primaryServiceArea]),
          email,
          phone || null,
          website,
          JSON.stringify(socialProfile ? { primary: socialProfile } : {}),
        )
        await transaction.$executeRawUnsafe(
          `INSERT INTO wewed_admin."ProviderVerification" ("id", "businessAccountId", "legalName", "registrationNumber", "representativeName", "secondaryContact") VALUES ($1, $2, $3, $4, $5, $6)`,
          `provider-verification-${randomUUID()}`,
          accountId,
          businessName,
          registrationNumber || null,
          name,
          phone || null,
        )
        for (const category of requestedServices) {
          await transaction.$executeRawUnsafe(
            `INSERT INTO wewed_admin."ProviderServiceOffering" ("id", "businessAccountId", "category", "displayName", "status", "serviceAreas", "details", "completionScore") VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, '{}'::jsonb, 10) ON CONFLICT ("businessAccountId", "category") DO NOTHING`,
            `provider-offering-${randomUUID()}`,
            accountId,
            category,
            businessName,
            JSON.stringify([primaryServiceArea]),
          )
        }
      }
    })

    try {
      const receipt = registrationReceivedEmail({ name, businessName, applicationId: accountId })
      await sendTransactionalEmail({
        idempotencyKey: `registration-received-${accountId}`,
        category: 'registration_received',
        to: email,
        subject: receipt.subject,
        html: receipt.html,
        text: receipt.text,
        metadata: { accountId, authUserId, accountType, requestedRole, requestedPlan },
        tags: [
          { name: 'account_type', value: accountType },
          { name: 'plan', value: requestedPlan },
        ],
      })
    } catch (emailError) {
      console.error('[auth/register] Registration receipt email failed:', emailError)
    }

    return NextResponse.json({
      success: true,
      applicationId: accountId,
      confirmationRequired: !data.session,
      reservedProfileAttached: false,
      message: 'Your Wewed application is pending review. Internal onboarding follows approval.',
    })
  } catch (error) {
    if (authUserId) {
      try { await createSupabaseServiceClient().auth.admin.deleteUser(authUserId) } catch { /* administrator can reconcile later */ }
    }
    console.error('[auth/register] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to submit the registration right now.' }, { status: 500 })
  }
}
