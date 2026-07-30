import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession, type AppSession } from '@/lib/app-session'

export type MembershipRole = 'owner' | 'planner' | 'coordinator' | 'viewer' | 'admin'

export interface AccessibleWedding {
  id: string
  slug: string
  title: string
  date: Date
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
  membershipRole: MembershipRole
  membershipStatus: 'active' | 'invited'
  permissions: string[]
}

interface WeddingRow {
  id: string
  slug: string
  title: string
  date: Date
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
  membershipRole: MembershipRole
  membershipStatus: 'active' | 'invited'
  permissions: string | null
}

const DEFAULT_ROLE_PERMISSIONS: Record<MembershipRole, string[]> = {
  admin: ['*'],
  owner: ['*'],
  planner: [
    'planner.view',
    'planner.edit',
    'guests.view',
    'guests.edit',
    'budget.view',
    'budget.edit',
    'vendors.view',
    'vendors.edit',
    'timeline.view',
    'timeline.edit',
    'seating.view',
    'seating.edit',
    'content.edit',
    'media.upload',
    'import.execute',
    'export.data',
  ],
  coordinator: [
    'planner.view',
    'planner.edit',
    'guests.view',
    'guests.edit',
    'budget.view',
    'vendors.view',
    'timeline.view',
    'timeline.edit',
    'seating.view',
    'seating.edit',
    'export.data',
  ],
  viewer: [
    'planner.view',
    'guests.view',
    'budget.view',
    'vendors.view',
    'timeline.view',
    'seating.view',
    'export.data',
  ],
}

function parsePermissions(raw: string | null, role: MembershipRole): string[] {
  if (!raw) return DEFAULT_ROLE_PERMISSIONS[role]

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
      ? parsed
      : DEFAULT_ROLE_PERMISSIONS[role]
  } catch {
    return DEFAULT_ROLE_PERMISSIONS[role]
  }
}

export async function listAccessibleWeddings(
  userId: string,
  globalRole: AppSession['role']
): Promise<AccessibleWedding[]> {
  const rows =
    globalRole === 'admin'
      ? await db.$queryRawUnsafe<WeddingRow[]>(`
          SELECT w.id, w.slug, w.title, w.date, w.venue,
                 w."venueCity", w."venueCountry", w."coupleId",
                 'admin'::text AS "membershipRole",
                 'active'::text AS "membershipStatus",
                 NULL::text AS permissions
          FROM public."Wedding" w
          ORDER BY w.date ASC, w."createdAt" ASC
        `)
      : await db.$queryRawUnsafe<WeddingRow[]>(
          `
          SELECT w.id, w.slug, w.title, w.date, w.venue,
                 w."venueCity", w."venueCountry", w."coupleId",
                 m.role AS "membershipRole", m.status AS "membershipStatus",
                 m.permissions
          FROM public."WeddingMembership" m
          JOIN public."Wedding" w ON w.id = m."weddingId"
          WHERE m."userId" = $1
            AND m.status IN ('active', 'invited')
            AND (
              NOT EXISTS (
                SELECT 1
                FROM public."BusinessAccountMember" bam
                JOIN public."BusinessAccountLink" bal
                  ON bal."businessAccountId" = bam."businessAccountId"
                WHERE bam."userId" = m."userId"
                  AND bal."entityType" = 'wedding'
                  AND bal."entityId" = w.id
              )
              OR EXISTS (
                SELECT 1
                FROM public."BusinessAccountMember" bam
                JOIN public."BusinessAccount" ba
                  ON ba.id = bam."businessAccountId"
                JOIN public."BusinessAccountLink" bal
                  ON bal."businessAccountId" = bam."businessAccountId"
                WHERE bam."userId" = m."userId"
                  AND bam.status = 'active'
                  AND ba.status = 'active'
                  AND bal."entityType" = 'wedding'
                  AND bal."entityId" = w.id
              )
            )
          ORDER BY CASE WHEN m.status = 'active' THEN 0 ELSE 1 END,
                   w.date ASC, w."createdAt" ASC
        `,
          userId
        )

  return rows.map((row) => ({
    ...row,
    permissions: parsePermissions(row.permissions, row.membershipRole),
  }))
}

export async function acceptPendingMemberships(userId: string): Promise<void> {
  await db.$executeRawUnsafe(
    `
      UPDATE public."WeddingMembership"
      SET status = 'active',
          "acceptedAt" = COALESCE("acceptedAt", CURRENT_TIMESTAMP),
          "revokedAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = $1 AND status = 'invited'
    `,
    userId
  )
}

export interface WeddingContext {
  session: AppSession
  weddingId: string
  role: MembershipRole
  permissions: string[]
}

export async function getWeddingContext(
  request: NextRequest
): Promise<WeddingContext | null> {
  const session = readAppSession(request)
  if (!session?.activeWeddingId) return null

  if (session.role === 'admin') {
    const wedding = await db.wedding.findUnique({
      where: { id: session.activeWeddingId },
      select: { id: true },
    })

    return wedding
      ? { session, weddingId: wedding.id, role: 'admin', permissions: ['*'] }
      : null
  }

  const rows = await db.$queryRawUnsafe<
    Array<{
      weddingId: string
      role: MembershipRole
      permissions: string | null
    }>
  >(
    `
      SELECT m."weddingId", m.role, m.permissions
      FROM public."WeddingMembership" m
      WHERE m."userId" = $1
        AND m."weddingId" = $2
        AND m.status = 'active'
        AND (
          NOT EXISTS (
            SELECT 1
            FROM public."BusinessAccountMember" bam
            JOIN public."BusinessAccountLink" bal
              ON bal."businessAccountId" = bam."businessAccountId"
            WHERE bam."userId" = m."userId"
              AND bal."entityType" = 'wedding'
              AND bal."entityId" = m."weddingId"
          )
          OR EXISTS (
            SELECT 1
            FROM public."BusinessAccountMember" bam
            JOIN public."BusinessAccount" ba
              ON ba.id = bam."businessAccountId"
            JOIN public."BusinessAccountLink" bal
              ON bal."businessAccountId" = bam."businessAccountId"
            WHERE bam."userId" = m."userId"
              AND bam.status = 'active'
              AND ba.status = 'active'
              AND bal."entityType" = 'wedding'
              AND bal."entityId" = m."weddingId"
          )
        )
      LIMIT 1
    `,
    session.userId,
    session.activeWeddingId
  )

  const membership = rows[0]
  return membership
    ? {
        session,
        weddingId: membership.weddingId,
        role: membership.role,
        permissions: parsePermissions(membership.permissions, membership.role),
      }
    : null
}

export function contextHasPermission(
  context: WeddingContext,
  permission: string
): boolean {
  return context.permissions.includes('*') || context.permissions.includes(permission)
}

export async function requireWeddingPermission(
  request: NextRequest,
  permission: string
): Promise<
  | { context: WeddingContext; error: null }
  | { context: null; error: NextResponse }
> {
  const context = await getWeddingContext(request)

  if (!context) {
    return {
      context: null,
      error: NextResponse.json(
        { success: false, error: 'Unauthorized or wedding access was revoked.' },
        { status: 401 }
      ),
    }
  }

  if (!contextHasPermission(context, permission)) {
    return {
      context: null,
      error: NextResponse.json(
        { success: false, error: `Forbidden — requires ${permission} permission.` },
        { status: 403 }
      ),
    }
  }

  return { context, error: null }
}
