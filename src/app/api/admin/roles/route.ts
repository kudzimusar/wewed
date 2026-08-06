import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
} from '@/lib/wewed-admin'
import { isWewedAdminRole } from '@/lib/wewed-admin-policy'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AuthIdentityRow = {
  id: string
  userMetadata: unknown
}

type ExistingMembershipRow = {
  membershipId: string
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

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }

  console.error('[api/admin/roles] Error:', error)

  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  const authUnavailable =
    name.includes('AuthRetryableFetchError') ||
    name.includes('AuthApiError') ||
    /auth\/v1|supabase|fetch failed|failed to fetch/i.test(message)

  if (authUnavailable) {
    return NextResponse.json(
      {
        success: false,
        error:
          'The secure invitation service is temporarily unavailable. No administrator access was granted. Please retry.',
      },
      { status: 503 },
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Unable to complete the administrator invitation request.',
    },
    { status: 500 },
  )
}

async function listMembers() {
  return db.$queryRawUnsafe<
    Array<{
      membershipId: string
      userId: string
      email: string
      name: string | null
      userActive: boolean
      lastLoginAt: Date | null
      role: string
      status: string
      createdAt: Date
      updatedAt: Date
      authUserId: string | null
      alternateEmails: unknown
      phone: string | null
      addressLine1: string | null
      addressLine2: string | null
      city: string | null
      stateProvince: string | null
      postalCode: string | null
      country: string | null
      certificates: unknown
      invitationStatus: string | null
      invitationSentAt: Date | null
      invitationAcceptedAt: Date | null
      profileCompletedAt: Date | null
    }>
  >(`
    SELECT bam.id AS "membershipId", u.id AS "userId", u.email,
      COALESCE(ap."fullName", u.name) AS name,
      u."isActive" AS "userActive", u."lastLoginAt", bam.role, bam.status,
      bam."createdAt", bam."updatedAt",
      ap."authUserId"::text AS "authUserId", ap."alternateEmails", ap.phone,
      ap."addressLine1", ap."addressLine2", ap.city, ap."stateProvince",
      ap."postalCode", ap.country, ap.certificates,
      ap."invitationStatus", ap."invitationSentAt", ap."invitationAcceptedAt",
      ap."profileCompletedAt"
    FROM wewed_admin."BusinessAccountMember" bam
    JOIN wewed_admin."BusinessAccount" ba ON ba.id = bam."businessAccountId"
    JOIN public."User" u ON u.id = bam."userId"
    LEFT JOIN wewed_admin."AdministratorProfile" ap ON ap."userId" = u.id
    WHERE ba.type = 'wewed_internal'
    ORDER BY CASE bam.role
      WHEN 'wewed_super_admin' THEN 0
      WHEN 'wewed_operations_admin' THEN 1
      WHEN 'wewed_billing_admin' THEN 2
      WHEN 'wewed_support_admin' THEN 3
      WHEN 'wewed_analyst' THEN 4
      ELSE 5
    END, lower(u.email)
  `)
}

async function findAuthIdentityByEmail(
  email: string,
): Promise<AuthIdentityRow | null> {
  const rows = await db.$queryRawUnsafe<AuthIdentityRow[]>(
    `SELECT id::text AS id,
       COALESCE(raw_user_meta_data, '{}'::jsonb) AS "userMetadata"
     FROM auth.users
     WHERE lower(email) = lower($1)
       AND deleted_at IS NULL
     LIMIT 1`,
    email,
  )

  return rows[0] ?? null
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(
      request,
      'admin.platform_admins.manage',
    )
    const members = await listMembers()

    return NextResponse.json({
      success: true,
      admin: {
        email: context.session.email,
        role: context.adminRole,
        permissions: context.permissions,
      },
      members,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(
      request,
      'admin.platform_admins.manage',
    )
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 50)

    if (action === 'update_admin_role') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Role, lifecycle, and scope changes are available only in Admin → Platform administrators, where a reason and all governance safeguards are required.',
        },
        { status: 409 },
      )
    }

    if (action !== 'add_admin_member') {
      return NextResponse.json(
        { success: false, error: 'Unknown administrator invitation action.' },
        { status: 400 },
      )
    }

    const email = text(body.email, 180).toLowerCase()
    const fullName = text(body.fullName ?? body.name, 160)
    const role = text(body.role, 80)
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

    if (!EMAIL_PATTERN.test(email) || !fullName || !isWewedAdminRole(role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'A valid email, full name and Wewed role are required.',
        },
        { status: 400 },
      )
    }

    const [existingAppUser, existingMembership] = await Promise.all([
      db.user.findUnique({
        where: { email },
        select: { id: true, role: true, isActive: true },
      }),
      db.$queryRawUnsafe<ExistingMembershipRow[]>(
        `SELECT bam.id AS "membershipId", bam.status
         FROM wewed_admin."BusinessAccountMember" bam
         JOIN public."User" u ON u.id = bam."userId"
         WHERE bam."businessAccountId" = $1
           AND lower(u.email) = lower($2)
         LIMIT 1`,
        context.businessAccountId,
        email,
      ).then((rows) => rows[0] ?? null),
    ])

    if (existingAppUser && existingAppUser.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error:
            'This email belongs to a client or planner identity. Use a separate Wewed administrator email to preserve role separation.',
        },
        { status: 409 },
      )
    }

    const service = createSupabaseServiceClient()
    const existingIdentity = await findAuthIdentityByEmail(email)
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
    const redirectTo = `${request.nextUrl.origin}/admin/accept-invite`

    let authUserId = existingIdentity?.id ?? null
    let invitationSent = false
    let invitationKind: 'invite' | 'recovery' = 'invite'

    if (!authUserId) {
      const { data, error } = await service.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            display_name: fullName,
            wewed_role: 'admin',
            administrator_profile: profileMetadata,
          },
          redirectTo,
        },
      )
      if (error || !data.user) {
        throw error || new Error('Supabase did not create an invited user.')
      }
      authUserId = data.user.id
      invitationSent = true
    } else {
      const { error: updateError } = await service.auth.admin.updateUserById(
        authUserId,
        {
          user_metadata: {
            ...metadata(existingIdentity?.userMetadata),
            display_name: fullName,
            wewed_role: 'admin',
            administrator_profile: profileMetadata,
          },
        },
      )
      if (updateError) throw updateError

      const { error: recoveryError } =
        await service.auth.resetPasswordForEmail(email, { redirectTo })
      if (recoveryError) throw recoveryError
      invitationSent = true
      invitationKind = 'recovery'
    }

    const membershipStatus =
      existingMembership?.status === 'active' ? 'active' : 'invited'
    const appUser = existingAppUser
      ? await db.user.update({
          where: { id: existingAppUser.id },
          data: {
            name: fullName,
            role: 'admin',
            isActive: membershipStatus === 'active',
          },
        })
      : await db.user.create({
          data: {
            id: randomUUID(),
            email,
            name: fullName,
            role: 'admin',
            isActive: false,
          },
        })

    await db.$transaction([
      db.userProfile.upsert({
        where: { id: authUserId },
        create: {
          id: authUserId,
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
        `INSERT INTO wewed_admin."BusinessAccountMember"
          ("id", "businessAccountId", "userId", "role", "status", "permissions")
         VALUES ($1, $2, $3, $4, $5, '[]'::jsonb)
         ON CONFLICT ("businessAccountId", "userId") DO UPDATE SET
           role = EXCLUDED.role,
           status = CASE
             WHEN wewed_admin."BusinessAccountMember".status = 'active'
               THEN 'active'
             ELSE 'invited'
           END,
           permissions = '[]'::jsonb,
           "updatedAt" = CURRENT_TIMESTAMP`,
        `member-wewed-admin-${appUser.id}`,
        context.businessAccountId,
        appUser.id,
        role,
        membershipStatus,
      ),
      db.$executeRawUnsafe(
        `INSERT INTO wewed_admin."AdministratorProfile" (
           "userId", "authUserId", "primaryEmail", "alternateEmails",
           "fullName", phone, "addressLine1", "addressLine2", city,
           "stateProvince", "postalCode", country, certificates,
           "invitationStatus", "invitationSentAt"
         ) VALUES (
           $1, $2::uuid, $3, $4::jsonb, $5, $6, $7, $8, $9,
           $10, $11, $12, $13::jsonb, $14, CURRENT_TIMESTAMP
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
           "invitationStatus" = CASE
             WHEN wewed_admin."AdministratorProfile"."invitationStatus" = 'active'
               THEN 'active'
             ELSE EXCLUDED."invitationStatus"
           END,
           "invitationSentAt" = CURRENT_TIMESTAMP,
           "updatedAt" = CURRENT_TIMESTAMP`,
        appUser.id,
        authUserId,
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
        membershipStatus,
      ),
    ])

    await writeBusinessAudit({
      actorUserId: context.session.userId,
      businessAccountId: context.businessAccountId,
      action:
        membershipStatus === 'active'
          ? 'admin_membership.profile_updated'
          : 'admin_membership.invited',
      resourceType: 'User',
      resourceId: appUser.id,
      details: {
        email,
        fullName,
        role,
        invitationSent,
        invitationKind,
        profileFields: {
          alternateEmailCount: alternateEmails.length,
          hasPhone: Boolean(phone),
          hasAddress: Boolean(addressLine1 || city || country),
          certificateCount: certificates.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      invitationSent,
      invitationKind,
      membershipStatus,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
