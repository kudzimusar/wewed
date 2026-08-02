import 'server-only'

import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { readAppSession, type AppSession, type DashboardRole } from '@/lib/app-session'
import { db } from '@/lib/db'
import { getWeddingContext } from '@/lib/wedding-access'
import { writeBusinessAudit } from '@/lib/wewed-admin'

export class MarketplaceAccessError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 = 400,
  ) {
    super(message)
    this.name = 'MarketplaceAccessError'
  }
}

export type AuthorityBundle =
  | 'consultation'
  | 'planning'
  | 'coordination'
  | 'full_coordination'

export const AUTHORITY_BUNDLES: Record<
  AuthorityBundle,
  { role: 'viewer' | 'planner' | 'coordinator'; permissions: string[]; label: string }
> = {
  consultation: {
    label: 'Consultation',
    role: 'viewer',
    permissions: ['planner.view'],
  },
  planning: {
    label: 'Planning',
    role: 'planner',
    permissions: [
      'planner.view',
      'planner.edit',
      'guests.view',
      'budget.view',
      'vendors.view',
      'vendors.edit',
      'timeline.view',
      'timeline.edit',
      'seating.view',
      'export.data',
    ],
  },
  coordination: {
    label: 'Coordination',
    role: 'coordinator',
    permissions: [
      'planner.view',
      'planner.edit',
      'guests.view',
      'guests.edit',
      'budget.view',
      'vendors.view',
      'vendors.edit',
      'timeline.view',
      'timeline.edit',
      'seating.view',
      'seating.edit',
      'export.data',
    ],
  },
  full_coordination: {
    label: 'Full coordination',
    role: 'planner',
    permissions: [
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
  },
}

interface ActiveUserRow {
  id: string
  role: DashboardRole
  email: string
  isActive: boolean
}

interface BusinessContextRow {
  businessAccountId: string
  businessName: string
  businessSlug: string
  businessType: string
  subscriptionPlan: string
  subscriptionStatus: string
  memberRole: string | null
}

export interface MarketplaceUserContext {
  session: AppSession
  user: ActiveUserRow
}

export interface PlannerMarketplaceContext extends MarketplaceUserContext {
  business: BusinessContextRow
}

export interface CoupleMarketplaceContext extends MarketplaceUserContext {
  weddingId: string
  weddingTitle: string
  weddingSlug: string
  coupleBusinessAccountId: string
  coupleBusinessName: string
}

export function marketplaceId(prefix: string): string {
  return `${prefix}-${randomUUID()}`
}

export function isAuthorityBundle(value: unknown): value is AuthorityBundle {
  return typeof value === 'string' && value in AUTHORITY_BUNDLES
}

export function stringList(value: unknown, limit = 20): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []

  return Array.from(
    new Set(
      source
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 100)),
    ),
  ).slice(0, limit)
}

export function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

export function toPublicProfile(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    yearsExperience: row.yearsExperience,
    serviceAreas: stringList(row.serviceAreas),
    services: stringList(row.services),
    weddingStyles: stringList(row.weddingStyles),
    languages: stringList(row.languages),
    priceBand: row.priceBand,
    minimumGuestCount: row.minimumGuestCount,
    maximumGuestCount: row.maximumGuestCount,
    availabilityStatus: row.availabilityStatus,
    portfolio: stringList(row.portfolio, 12),
    publishedAt: row.publishedAt,
  }
}

export async function requireMarketplaceUser(
  request: NextRequest,
  roles: readonly DashboardRole[],
): Promise<MarketplaceUserContext> {
  const session = readAppSession(request)
  if (!session) throw new MarketplaceAccessError('Sign in is required.', 401)
  if (!roles.includes(session.role)) {
    throw new MarketplaceAccessError('This Wewed account cannot use this operation.', 403)
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, email: true, isActive: true },
  })

  if (
    !user ||
    !user.isActive ||
    user.role !== session.role ||
    user.email.toLowerCase() !== session.email.toLowerCase()
  ) {
    throw new MarketplaceAccessError('The signed-in Wewed account is inactive.', 401)
  }

  return { session, user: user as ActiveUserRow }
}

export async function requirePlannerMarketplace(
  request: NextRequest,
): Promise<PlannerMarketplaceContext> {
  const base = await requireMarketplaceUser(request, ['planner'])
  const rows = await db.$queryRawUnsafe<BusinessContextRow[]>(
    `SELECT
       ba.id AS "businessAccountId",
       ba.name AS "businessName",
       ba.slug AS "businessSlug",
       ba.type AS "businessType",
       ba."subscriptionPlan",
       ba."subscriptionStatus",
       bam.role AS "memberRole"
     FROM public."BusinessAccountMember" bam
     JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
     WHERE bam."userId" = $1
       AND bam.status = 'active'
       AND ba.type = 'planning_company'
       AND ba.status = 'active'
       AND ba."onboardingStatus" = 'complete'
     ORDER BY CASE bam.role WHEN 'business_owner' THEN 0 ELSE 1 END, ba."createdAt"
     LIMIT 1`,
    base.user.id,
  )

  if (!rows[0]) {
    throw new MarketplaceAccessError(
      'An active, completely onboarded planning business is required.',
      403,
    )
  }

  return { ...base, business: rows[0] }
}

export async function requireCoupleMarketplace(
  request: NextRequest,
): Promise<CoupleMarketplaceContext> {
  const base = await requireMarketplaceUser(request, ['couple'])
  const wedding = await getWeddingContext(request)
  if (!wedding || wedding.session.userId !== base.user.id || wedding.role !== 'owner') {
    throw new MarketplaceAccessError('Couple ownership of the active wedding is required.', 403)
  }

  const rows = await db.$queryRawUnsafe<
    Array<{
      weddingTitle: string
      weddingSlug: string
      coupleBusinessAccountId: string
      coupleBusinessName: string
    }>
  >(
    `SELECT
       w.title AS "weddingTitle",
       w.slug AS "weddingSlug",
       ba.id AS "coupleBusinessAccountId",
       ba.name AS "coupleBusinessName"
     FROM public."Wedding" w
     JOIN public."BusinessAccountLink" bal
       ON bal."entityType" = 'wedding'
      AND bal."entityId" = w.id
      AND bal.relationship = 'owns'
     JOIN public."BusinessAccount" ba
       ON ba.id = bal."businessAccountId"
      AND ba.type = 'couple'
      AND ba.status = 'active'
      AND ba."onboardingStatus" = 'complete'
     WHERE w.id = $1
     LIMIT 1`,
    wedding.weddingId,
  )

  if (!rows[0]) {
    throw new MarketplaceAccessError(
      'The active wedding is not connected to a complete couple business account.',
      409,
    )
  }

  return {
    ...base,
    weddingId: wedding.weddingId,
    ...rows[0],
  }
}

export async function marketplaceAudit(input: {
  actorUserId: string
  businessAccountId?: string | null
  action: string
  resourceType: string
  resourceId: string
  details?: Record<string, unknown>
}): Promise<void> {
  await writeBusinessAudit(input)
}
