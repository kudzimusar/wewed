import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeBusinessAudit } from '@/lib/wewed-admin'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type InvitationMembership = {
  appUserId: string
  membershipId: string
  businessAccountId: string
  role: string
  status: string
}

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function nullableText(value: unknown, max = 500): string | null {
  return text(value, max) || null
}

function stringList(
  value: unknown,
  options: { maxItems: number; maxLength: number },
): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => text(item, options.maxLength))
        .filter(Boolean),
    ),
  ).slice(0, options.maxItems)
}

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get('authorization') || ''
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : ''
}

function failure(error: unknown) {
  console.error('[api/admin/invitations/accept] Error:', error)
  return NextResponse.json(
    {
      success: false,
      error: 'Unable to accept this administrator invitation right now.',
    },
    { status: 500 },
  )
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request)
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'A valid invitation session is required.' },
        { status: 401 },
      )
    }

    const service = createSupabaseServiceClient()
    const { data, error: userError } = await service.auth.getUser(token)
    const authUser = data.user
    const email = authUser?.email?.trim().toLowerCase() || ''

    if (userError || !authUser || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'This invitation is invalid, expired, or has already been replaced.',
        },
        { status: 401 },
      )
    }

    const memberships = await db.$queryRawUnsafe<InvitationMembership[]>(
      `SELECT u.id AS "appUserId", bam.id AS "membershipId",
         bam."businessAccountId", bam.role, bam.status
       FROM public."User" u
       JOIN public."BusinessAccountMember" bam ON bam."userId" = u.id
       JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
       WHERE lower(u.email) = lower($1)
         AND u.role = 'admin'
         AND ba.type = 'wewed_internal'
         AND ba.status = 'active'
       LIMIT 1`,
      email,
    )
    const membership = memberships[0]

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          error: 'This email no longer has a Wewed administrator invitation.',
        },
        { status: 403 },
      )
    }

    if (!['invited', 'active'].includes(membership.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `This administrator invitation is ${membership.status}. Contact a Wewed Super Admin.`,
        },
        { status: 403 },
      )
    }

    const body = (await request.json()) as Record<string, unknown>
    const fullName = text(body.fullName, 160)
    const alternateEmails = stringList(body.alternateEmails, {
      maxItems: 5,
      maxLength: 180,
    })
      .map((item) => item.toLowerCase())
      .filter((item) => item !== email && EMAIL_PATTERN.test(item))
    const phone = nullableText(body.phone, 60)
    const addressLine1 = nullableText(body.addressLine1, 180)
    const addressLine2 = nullableText(body.addressLine2, 180)
    const city = nullableText(body.city, 100)
    const stateProvince = nullableText(body.stateProvince, 100)
    const postalCode = nullableText(body.postalCode, 40)
    const country = nullableText(body.country, 100)
    const certificates = stringList(body.certificates, {
      maxItems: 20,
      maxLength: 240,
    })

    if (!fullName) {
      return NextResponse.json(
        { success: false, error: 'Your full name is required.' },
        { status: 400 },
      )
    }

    const profileMetadata = {
      alternate_emails: alternateEmails,
      phone,
      address: {
        line1: addressLine1,
        line2: addressLine2,
        city,
        state_province: stateProvince,
        postal_code: postalCode,
        country,
      },
      certificates,
    }

    const { error: metadataError } = await service.auth.admin.updateUserById(
      authUser.id,
      {
        user_metadata: {
          ...metadata(authUser.user_metadata),
          display_name: fullName,
          wewed_role: 'admin',
          administrator_profile: profileMetadata,
        },
      },
    )
    if (metadataError) throw metadataError

    await db.$transaction([
      db.user.update({
        where: { id: membership.appUserId },
        data: {
          name: fullName,
          role: 'admin',
          isActive: true,
        },
      }),
      db.userProfile.upsert({
        where: { id: authUser.id },
        create: {
          id: authUser.id,
          email,
          displayName: fullName,
          role: 'admin',
        },
        update: {
          email,
          displayName: fullName,
          role: 'admin',
          isBanned: false,
          bannedAt: null,
          banReason: null,
        },
      }),
      db.$executeRawUnsafe(
        `UPDATE public."BusinessAccountMember"
         SET status = 'active', "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        membership.membershipId,
      ),
      db.$executeRawUnsafe(
        `INSERT INTO wewed_admin."AdministratorProfile" (
           "userId", "authUserId", "primaryEmail", "alternateEmails",
           "fullName", phone, "addressLine1", "addressLine2", city,
           "stateProvince", "postalCode", country, certificates,
           "invitationStatus", "invitationAcceptedAt", "profileCompletedAt"
         ) VALUES (
           $1, $2::uuid, $3, $4::jsonb, $5, $6, $7, $8, $9,
           $10, $11, $12, $13::jsonb, 'active', CURRENT_TIMESTAMP,
           CURRENT_TIMESTAMP
         )
         ON CONFLICT ("userId") DO UPDATE SET
           "authUserId" = EXCLUDED."authUserId",
           "primaryEmail" = EXCLUDED."primaryEmail",
           "alternateEmails" = EXCLUDED."alternateEmails",
           "fullName" = EXCLUDED."fullName",
           phone = EXCLUDED.phone,
           "addressLine1" = EXCLUDED."addressLine1",
           "addressLine2" = EXCLUDED."addressLine2",
           city = EXCLUDED.city,
           "stateProvince" = EXCLUDED."stateProvince",
           "postalCode" = EXCLUDED."postalCode",
           country = EXCLUDED.country,
           certificates = EXCLUDED.certificates,
           "invitationStatus" = 'active',
           "invitationAcceptedAt" = COALESCE(
             wewed_admin."AdministratorProfile"."invitationAcceptedAt",
             CURRENT_TIMESTAMP
           ),
           "profileCompletedAt" = CURRENT_TIMESTAMP,
           "updatedAt" = CURRENT_TIMESTAMP`,
        membership.appUserId,
        authUser.id,
        email,
        JSON.stringify(alternateEmails),
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        stateProvince,
        postalCode,
        country,
        JSON.stringify(certificates),
      ),
    ])

    await writeBusinessAudit({
      actorUserId: membership.appUserId,
      businessAccountId: membership.businessAccountId,
      action: 'admin_membership.accepted',
      resourceType: 'BusinessAccountMember',
      resourceId: membership.membershipId,
      details: {
        email,
        fullName,
        role: membership.role,
        alternateEmailCount: alternateEmails.length,
        certificateCount: certificates.length,
      },
    })

    return NextResponse.json({
      success: true,
      email,
      membershipStatus: 'active',
    })
  } catch (error) {
    return failure(error)
  }
}
