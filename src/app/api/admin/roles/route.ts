import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertWewedAdminPermission,
  createBusinessId,
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
} from '@/lib/wewed-admin'
import { isWewedAdminRole } from '@/lib/wewed-admin-policy'
import {
  createSupabaseServiceClient,
  findSupabaseAuthUserByEmail,
} from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  console.error('[api/admin/roles] Error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to complete the role-management request.' },
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
    }>
  >(`
    SELECT bam.id AS "membershipId", u.id AS "userId", u.email, u.name,
      u."isActive" AS "userActive", u."lastLoginAt", bam.role, bam.status,
      bam."createdAt", bam."updatedAt"
    FROM public."BusinessAccountMember" bam
    JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
    JOIN public."User" u ON u.id = bam."userId"
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

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.members.read')
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
    const context = await requireWewedAdmin(request, 'admin.members.manage')
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 50)

    if (action === 'add_admin_member') {
      const email = text(body.email, 180).toLowerCase()
      const name = text(body.name, 120) || email.split('@')[0]
      const role = text(body.role, 80)

      if (!email || !isWewedAdminRole(role)) {
        return NextResponse.json(
          { success: false, error: 'A valid email and Wewed role are required.' },
          { status: 400 },
        )
      }
      if (role === 'wewed_super_admin' && context.adminRole !== 'wewed_super_admin') {
        throw new WewedAdminAccessError('Only a Super Admin may assign the Super Admin role.', 403)
      }

      const existingAppUser = await db.user.findUnique({
        where: { email },
        select: { id: true, role: true, isActive: true },
      })
      if (existingAppUser && existingAppUser.role !== 'admin') {
        return NextResponse.json(
          {
            success: false,
            error: 'This email belongs to a client or planner identity. Use a separate Wewed administrator email to preserve role separation.',
          },
          { status: 409 },
        )
      }

      const service = createSupabaseServiceClient()
      let authUser = await findSupabaseAuthUserByEmail(service, email)
      let invitationSent = false

      if (!authUser) {
        const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
          data: { display_name: name, wewed_role: 'admin' },
          redirectTo: `${request.nextUrl.origin}/admin`,
        })
        if (error || !data.user) throw error || new Error('Supabase did not create an invited user.')
        authUser = data.user
        invitationSent = true
      } else {
        const { data, error } = await service.auth.admin.updateUserById(authUser.id, {
          user_metadata: {
            ...authUser.user_metadata,
            display_name: name,
            wewed_role: 'admin',
          },
        })
        if (error || !data.user) throw error || new Error('Unable to update the Supabase identity.')
        authUser = data.user
      }

      const appUser = existingAppUser
        ? await db.user.update({
            where: { id: existingAppUser.id },
            data: { name, role: 'admin', isActive: true },
          })
        : await db.user.create({
            data: {
              id: randomUUID(),
              email,
              name,
              role: 'admin',
              isActive: true,
            },
          })

      await db.$transaction([
        db.userProfile.upsert({
          where: { id: authUser.id },
          create: {
            id: authUser.id,
            email,
            displayName: name,
            role: 'admin',
          },
          update: {
            email,
            displayName: name,
            role: 'admin',
            isBanned: false,
            bannedAt: null,
            banReason: null,
          },
        }),
        db.$executeRawUnsafe(
          `INSERT INTO public."BusinessAccountMember"
            ("id", "businessAccountId", "userId", "role", "status", "permissions")
           VALUES ($1, $2, $3, $4, 'active', '[]'::jsonb)
           ON CONFLICT ("businessAccountId", "userId") DO UPDATE SET
             role = EXCLUDED.role,
             status = 'active',
             permissions = '[]'::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP`,
          `member-wewed-admin-${appUser.id}`,
          context.businessAccountId,
          appUser.id,
          role,
        ),
      ])

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId: context.businessAccountId,
        action: invitationSent ? 'admin_membership.invited' : 'admin_membership.added',
        resourceType: 'User',
        resourceId: appUser.id,
        details: { email, name, role, invitationSent },
      })

      return NextResponse.json({ success: true, invitationSent })
    }

    if (action === 'update_admin_role') {
      assertWewedAdminPermission(context, 'admin.members.manage')
      const membershipId = text(body.membershipId, 120)
      const role = text(body.role, 80)
      const status = text(body.status, 40) || 'active'

      if (!membershipId || !isWewedAdminRole(role) || !['active', 'suspended', 'revoked'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'A valid administrator membership, role and status are required.' },
          { status: 400 },
        )
      }
      if (role === 'wewed_super_admin' && context.adminRole !== 'wewed_super_admin') {
        throw new WewedAdminAccessError('Only a Super Admin may assign the Super Admin role.', 403)
      }

      const targets = await db.$queryRawUnsafe<
        Array<{ membershipId: string; userId: string; email: string; role: string; status: string }>
      >(
        `SELECT bam.id AS "membershipId", bam."userId", u.email, bam.role, bam.status
         FROM public."BusinessAccountMember" bam
         JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
         JOIN public."User" u ON u.id = bam."userId"
         WHERE bam.id = $1 AND ba.type = 'wewed_internal'
         LIMIT 1`,
        membershipId,
      )
      const target = targets[0]
      if (!target) {
        return NextResponse.json({ success: false, error: 'Administrator membership was not found.' }, { status: 404 })
      }

      if (target.role === 'wewed_super_admin' && (role !== 'wewed_super_admin' || status !== 'active')) {
        const counts = await db.$queryRawUnsafe<Array<{ count: number }>>(`
          SELECT COUNT(*)::int AS count
          FROM public."BusinessAccountMember" bam
          JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
          WHERE ba.type = 'wewed_internal'
            AND bam.role = 'wewed_super_admin'
            AND bam.status = 'active'
        `)
        if ((counts[0]?.count ?? 0) <= 1) {
          return NextResponse.json(
            { success: false, error: 'At least one active Wewed Super Admin must remain.' },
            { status: 409 },
          )
        }
      }

      await db.$executeRawUnsafe(
        `UPDATE public."BusinessAccountMember"
         SET role = $2, status = $3, permissions = '[]'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        membershipId,
        role,
        status,
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId: context.businessAccountId,
        action: 'admin_membership.updated',
        resourceType: 'BusinessAccountMember',
        resourceId: membershipId,
        details: {
          targetEmail: target.email,
          previousRole: target.role,
          role,
          previousStatus: target.status,
          status,
        },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unknown role-management action.' }, { status: 400 })
  } catch (error) {
    return errorResponse(error)
  }
}
