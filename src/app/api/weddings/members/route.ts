import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

const MEMBERSHIP_ROLES = ['owner', 'planner', 'coordinator', 'viewer'] as const
const MEMBERSHIP_STATUSES = ['invited', 'active', 'revoked'] as const

type MembershipRole = (typeof MEMBERSHIP_ROLES)[number]
type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]

interface MemberRow {
  id: string
  userId: string
  weddingId: string
  role: MembershipRole
  status: MembershipStatus
  permissions: string | null
  invitedById: string | null
  acceptedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
  email: string
  name: string | null
  isActive: boolean
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase service-role configuration.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function normalizePermissions(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('permissions must be an array of strings.')
  }
  return JSON.stringify(Array.from(new Set(value)))
}

function serializeMember(member: MemberRow) {
  let permissions: string[] | null = null
  if (member.permissions) {
    try {
      const parsed = JSON.parse(member.permissions)
      permissions = Array.isArray(parsed) ? parsed : null
    } catch {
      permissions = null
    }
  }

  return {
    ...member,
    permissions,
    acceptedAt: member.acceptedAt?.toISOString() ?? null,
    revokedAt: member.revokedAt?.toISOString() ?? null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  }
}

async function getMembers(weddingId: string) {
  return db.$queryRawUnsafe<MemberRow[]>(
    `
      SELECT m.id,
             m."userId",
             m."weddingId",
             m.role,
             m.status,
             m.permissions,
             m."invitedById",
             m."acceptedAt",
             m."revokedAt",
             m."createdAt",
             m."updatedAt",
             u.email,
             u.name,
             u."isActive"
      FROM public."WeddingMembership" m
      JOIN public."User" u ON u.id = m."userId"
      WHERE m."weddingId" = $1
      ORDER BY
        CASE m.role
          WHEN 'owner' THEN 0
          WHEN 'planner' THEN 1
          WHEN 'coordinator' THEN 2
          ELSE 3
        END,
        lower(u.email)
    `,
    weddingId
  )
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (error) throw error
  return data.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'members.manage')
  if (access.error) return access.error

  try {
    const members = await getMembers(access.context.weddingId)
    return NextResponse.json({
      success: true,
      count: members.length,
      data: members.map(serializeMember),
    })
  } catch (error) {
    console.error('[weddings/members GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load wedding members.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'members.manage')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as {
      email?: unknown
      name?: unknown
      role?: unknown
      permissions?: unknown
    }

    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const role = MEMBERSHIP_ROLES.includes(body.role as MembershipRole)
      ? (body.role as MembershipRole)
      : 'planner'
    const permissions = normalizePermissions(body.permissions)

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'A valid email is required.' },
        { status: 400 }
      )
    }

    const wedding = await db.wedding.findUnique({
      where: { id: access.context.weddingId },
      select: { coupleId: true, title: true },
    })
    if (!wedding) {
      return NextResponse.json(
        { success: false, error: 'Wedding not found.' },
        { status: 404 }
      )
    }

    const supabase = getServiceClient()
    let authUserId = await findAuthUserIdByEmail(email)
    let invitationSent = false

    if (!authUserId) {
      const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/`
        : undefined
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { display_name: name || undefined, wedding: wedding.title },
        redirectTo,
      })
      if (error || !data.user) throw error ?? new Error('Invitation failed.')
      authUserId = data.user.id
      invitationSent = true
    }

    let user = await db.user.findUnique({ where: { email } })
    const desiredGlobalRole = role === 'owner' ? 'couple' : 'planner'

    if (!user) {
      user = await db.user.create({
        data: {
          id: authUserId,
          email,
          name: name || null,
          role: desiredGlobalRole,
          coupleId: wedding.coupleId,
          isActive: true,
        },
      })
    } else {
      const nextGlobalRole =
        user.role === 'admin'
          ? 'admin'
          : role === 'owner' || user.role === 'couple'
            ? 'couple'
            : 'planner'

      user = await db.user.update({
        where: { id: user.id },
        data: {
          name: name || user.name,
          role: nextGlobalRole,
          coupleId: user.coupleId ?? wedding.coupleId,
          isActive: true,
        },
      })
    }

    await db.userProfile.upsert({
      where: { id: authUserId },
      create: {
        id: authUserId,
        email,
        displayName: name || user.name || null,
        role: user.role,
      },
      update: {
        email,
        displayName: name || user.name || undefined,
        role: user.role,
        isBanned: false,
        bannedAt: null,
        banReason: null,
      },
    })

    const membershipId = `wm_${randomUUID().replace(/-/g, '')}`
    await db.$executeRawUnsafe(
      `
        INSERT INTO public."WeddingMembership" (
          id, "userId", "weddingId", role, status, permissions,
          "invitedById", "acceptedAt", "revokedAt", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 'invited', $5, $6, NULL, NULL,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", "weddingId") DO UPDATE
        SET role = EXCLUDED.role,
            status = CASE
              WHEN public."WeddingMembership".status = 'active' THEN 'active'
              ELSE 'invited'
            END,
            permissions = EXCLUDED.permissions,
            "invitedById" = EXCLUDED."invitedById",
            "revokedAt" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
      `,
      membershipId,
      user.id,
      access.context.weddingId,
      role,
      permissions,
      access.context.session.userId
    )

    const members = await getMembers(access.context.weddingId)
    const member = members.find((candidate) => candidate.userId === user.id)

    return NextResponse.json(
      {
        success: true,
        invitationSent,
        data: member ? serializeMember(member) : null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[weddings/members POST] Error:', error)
    const message = error instanceof Error ? error.message : 'Unable to invite member.'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'members.manage')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as {
      membershipId?: unknown
      role?: unknown
      status?: unknown
      permissions?: unknown
    }

    const membershipId =
      typeof body.membershipId === 'string' ? body.membershipId.trim() : ''
    if (!membershipId) {
      return NextResponse.json(
        { success: false, error: 'membershipId is required.' },
        { status: 400 }
      )
    }

    const existingRows = await db.$queryRawUnsafe<MemberRow[]>(
      `
        SELECT m.*, u.email, u.name, u."isActive"
        FROM public."WeddingMembership" m
        JOIN public."User" u ON u.id = m."userId"
        WHERE m.id = $1 AND m."weddingId" = $2
        LIMIT 1
      `,
      membershipId,
      access.context.weddingId
    )
    const existing = existingRows[0]
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Membership not found.' },
        { status: 404 }
      )
    }

    const role =
      body.role === undefined
        ? existing.role
        : MEMBERSHIP_ROLES.includes(body.role as MembershipRole)
          ? (body.role as MembershipRole)
          : null
    const status =
      body.status === undefined
        ? existing.status
        : MEMBERSHIP_STATUSES.includes(body.status as MembershipStatus)
          ? (body.status as MembershipStatus)
          : null

    if (!role || !status) {
      return NextResponse.json(
        { success: false, error: 'Invalid role or status.' },
        { status: 400 }
      )
    }

    if (
      existing.userId === access.context.session.userId &&
      existing.role === 'owner' &&
      (role !== 'owner' || status === 'revoked')
    ) {
      return NextResponse.json(
        { success: false, error: 'You cannot remove your own owner access.' },
        { status: 409 }
      )
    }

    const permissions =
      body.permissions === undefined
        ? existing.permissions
        : normalizePermissions(body.permissions)

    await db.$executeRawUnsafe(
      `
        UPDATE public."WeddingMembership"
        SET role = $3,
            status = $4,
            permissions = $5,
            "acceptedAt" = CASE
              WHEN $4 = 'active' THEN COALESCE("acceptedAt", CURRENT_TIMESTAMP)
              ELSE "acceptedAt"
            END,
            "revokedAt" = CASE WHEN $4 = 'revoked' THEN CURRENT_TIMESTAMP ELSE NULL END,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND "weddingId" = $2
      `,
      membershipId,
      access.context.weddingId,
      role,
      status,
      permissions
    )

    if (status === 'revoked') {
      await db.$executeRawUnsafe(
        `
          UPDATE public."User"
          SET "currentWeddingId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1 AND "currentWeddingId" = $2
        `,
        existing.userId,
        access.context.weddingId
      )
    }

    const members = await getMembers(access.context.weddingId)
    const member = members.find((candidate) => candidate.id === membershipId)
    return NextResponse.json({
      success: true,
      data: member ? serializeMember(member) : null,
    })
  } catch (error) {
    console.error('[weddings/members PATCH] Error:', error)
    const message = error instanceof Error ? error.message : 'Unable to update member.'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'members.manage')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as { membershipId?: unknown }
    const membershipId =
      typeof body.membershipId === 'string' ? body.membershipId.trim() : ''

    if (!membershipId) {
      return NextResponse.json(
        { success: false, error: 'membershipId is required.' },
        { status: 400 }
      )
    }

    const existing = await db.$queryRawUnsafe<Array<{ userId: string; role: string }>>(
      `
        SELECT "userId", role
        FROM public."WeddingMembership"
        WHERE id = $1 AND "weddingId" = $2
        LIMIT 1
      `,
      membershipId,
      access.context.weddingId
    )

    if (!existing[0]) {
      return NextResponse.json(
        { success: false, error: 'Membership not found.' },
        { status: 404 }
      )
    }

    if (
      existing[0].userId === access.context.session.userId &&
      existing[0].role === 'owner'
    ) {
      return NextResponse.json(
        { success: false, error: 'You cannot revoke your own owner access.' },
        { status: 409 }
      )
    }

    await db.$executeRawUnsafe(
      `
        UPDATE public."WeddingMembership"
        SET status = 'revoked', "revokedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND "weddingId" = $2
      `,
      membershipId,
      access.context.weddingId
    )

    await db.$executeRawUnsafe(
      `
        UPDATE public."User"
        SET "currentWeddingId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND "currentWeddingId" = $2
      `,
      existing[0].userId,
      access.context.weddingId
    )

    return NextResponse.json({ success: true, data: { membershipId, revoked: true } })
  } catch (error) {
    console.error('[weddings/members DELETE] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to revoke member.' },
      { status: 500 }
    )
  }
}
