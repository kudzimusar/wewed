import 'server-only'

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { CommunicationError, type CommunicationActor, type CommunicationContact } from '@/lib/communications'

interface VendorDirectoryRow {
  userId: string
  email: string
  userName: string | null
  businessName: string
}

async function coupleOwnsActiveWedding(actor: CommunicationActor): Promise<boolean> {
  if (actor.role !== 'couple' || !actor.coupleId || !actor.activeWeddingId) return false

  const rows = await db.$queryRaw<Array<{ ok: number }>>(Prisma.sql`
    SELECT 1 AS ok
    FROM public."WeddingMembership" membership
    JOIN public."Wedding" wedding
      ON wedding.id = membership."weddingId"
     AND wedding."coupleId" = ${actor.coupleId}
    WHERE membership."userId" = ${actor.userId}
      AND membership."weddingId" = ${actor.activeWeddingId}
      AND membership.status = 'active'
      AND membership.role = 'owner'
    LIMIT 1
  `)
  return rows.length === 1
}

export async function listEligibleVendorContacts(
  actor: CommunicationActor,
): Promise<CommunicationContact[]> {
  if (actor.role !== 'planner' && actor.role !== 'admin' && actor.role !== 'couple') return []
  if (actor.role === 'couple' && !(await coupleOwnsActiveWedding(actor))) return []

  const rows = await db.$queryRaw<VendorDirectoryRow[]>(Prisma.sql`
    SELECT DISTINCT ON (u.id)
      u.id AS "userId",
      u.email,
      u.name AS "userName",
      ba.name AS "businessName"
    FROM public."User" u
    JOIN public."BusinessAccountMember" bam
      ON bam."userId" = u.id
     AND bam.status = 'active'
     AND bam.role IN ('business_owner', 'vendor_manager')
    JOIN public."BusinessAccount" ba
      ON ba.id = bam."businessAccountId"
     AND ba.type = 'vendor'
     AND ba.status = 'active'
     AND ba."onboardingStatus" = 'complete'
    JOIN public."ProviderProfile" profile
      ON profile."businessAccountId" = ba.id
     AND profile."listingStatus" IN ('claimed', 'verified')
     AND profile.visibility = 'published'
     AND profile."isClaimable" = false
     AND profile."acceptingEnquiries" = true
    WHERE u."isActive" = true
      AND u.role = 'vendor'
    ORDER BY u.id, CASE WHEN ba."ownerUserId" = u.id THEN 0 ELSE 1 END, ba."createdAt" ASC
  `)

  return rows.map((row) => ({
    id: row.userId,
    name: row.businessName.trim() || row.userName?.trim() || row.email,
    email: row.email,
    role: 'vendor',
    defaultType: actor.role === 'admin' ? 'SUPPORT' : 'MARKETPLACE',
    context: 'wewed',
  }))
}

async function eligibleVendor(userId: string): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ ok: number }>>(Prisma.sql`
    SELECT 1 AS ok
    FROM public."User" u
    JOIN public."BusinessAccountMember" bam
      ON bam."userId" = u.id
     AND bam.status = 'active'
     AND bam.role IN ('business_owner', 'vendor_manager')
    JOIN public."BusinessAccount" ba
      ON ba.id = bam."businessAccountId"
     AND ba.type = 'vendor'
     AND ba.status = 'active'
     AND ba."onboardingStatus" = 'complete'
    JOIN public."ProviderProfile" profile
      ON profile."businessAccountId" = ba.id
     AND profile."listingStatus" IN ('claimed', 'verified')
     AND profile.visibility = 'published'
     AND profile."isClaimable" = false
     AND profile."acceptingEnquiries" = true
    WHERE u.id = ${userId}
      AND u."isActive" = true
      AND u.role = 'vendor'
    LIMIT 1
  `)
  return rows.length === 1
}

export async function eligibleVendorUserForBusinessAccount(
  businessAccountId: string,
): Promise<string | null> {
  const rows = await db.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
    SELECT u.id AS "userId"
    FROM public."BusinessAccount" ba
    JOIN public."BusinessAccountMember" bam
      ON bam."businessAccountId" = ba.id
     AND bam.status = 'active'
     AND bam.role IN ('business_owner', 'vendor_manager')
    JOIN public."User" u
      ON u.id = bam."userId"
     AND u."isActive" = true
     AND u.role = 'vendor'
    JOIN public."ProviderProfile" profile
      ON profile."businessAccountId" = ba.id
     AND profile."listingStatus" IN ('claimed', 'verified')
     AND profile.visibility = 'published'
     AND profile."isClaimable" = false
     AND profile."acceptingEnquiries" = true
    WHERE ba.id = ${businessAccountId}
      AND ba.type = 'vendor'
      AND ba.status = 'active'
      AND ba."onboardingStatus" = 'complete'
    ORDER BY CASE WHEN ba."ownerUserId" = u.id THEN 0 ELSE 1 END, bam."createdAt" ASC, u.id ASC
    LIMIT 1
  `)
  return rows[0]?.userId ?? null
}

export async function maybeCreateVendorMarketplaceConversation(
  actor: CommunicationActor,
  input: Record<string, unknown>,
): Promise<{ id: string; reused: boolean } | null> {
  const ids = Array.isArray(input.participantIds)
    ? input.participantIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  if (ids.length !== 1) return null

  const target = await db.user.findUnique({
    where: { id: ids[0] },
    select: { id: true, role: true, isActive: true },
  })
  if (!target || target.role !== 'vendor') return null

  if (actor.role !== 'planner' && actor.role !== 'couple' && actor.role !== 'admin') {
    throw new CommunicationError('This account cannot start a Vendor conversation.', 403)
  }
  if (actor.role === 'couple' && !(await coupleOwnsActiveWedding(actor))) {
    throw new CommunicationError('Couple ownership of the active wedding is required.', 403)
  }
  if (!target.isActive || !(await eligibleVendor(target.id))) {
    throw new CommunicationError('This vendor is not available for marketplace enquiries.', 403)
  }

  const conversationType = actor.role === 'admin' ? 'SUPPORT' : 'MARKETPLACE'
  const conversationWeddingId = actor.role === 'couple' ? actor.activeWeddingId : null

  if (typeof input.type === 'string' && input.type !== conversationType) {
    throw new CommunicationError(
      actor.role === 'admin'
        ? 'Administrator-to-vendor conversations use the support type.'
        : 'Couple and Planner vendor conversations use the marketplace type.',
      403,
    )
  }
  if (
    actor.role === 'couple'
    && typeof input.weddingId === 'string'
    && input.weddingId.trim()
    && input.weddingId !== actor.activeWeddingId
  ) {
    throw new CommunicationError('Vendor enquiries must use the Couple’s active wedding.', 403)
  }

  const weddingScope = conversationWeddingId
    ? Prisma.sql`c."weddingId" = ${conversationWeddingId}`
    : Prisma.sql`c."weddingId" IS NULL`

  const reusable = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT c.id
    FROM wewed_communications."CommunicationConversation" c
    WHERE c.kind = 'DIRECT'
      AND c.type = ${conversationType}
      AND c.status = 'OPEN'
      AND ${weddingScope}
      AND EXISTS (
        SELECT 1 FROM wewed_communications."CommunicationParticipant" p
        WHERE p."conversationId" = c.id AND p."userId" = ${actor.userId} AND p."leftAt" IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM wewed_communications."CommunicationParticipant" p
        WHERE p."conversationId" = c.id AND p."userId" = ${target.id} AND p."leftAt" IS NULL
      )
      AND (
        SELECT COUNT(*) FROM wewed_communications."CommunicationParticipant" p
        WHERE p."conversationId" = c.id AND p."leftAt" IS NULL
      ) = 2
    ORDER BY c."createdAt" ASC
    LIMIT 1
  `)
  if (reusable[0]) return { id: reusable[0].id, reused: true }

  const conversationId = randomUUID()
  const now = new Date()
  await db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO wewed_communications."CommunicationConversation"
        (id, kind, type, title, "weddingId", "createdByUserId", status, "createdAt", "updatedAt")
      VALUES (${conversationId}, 'DIRECT', ${conversationType}, NULL, ${conversationWeddingId}, ${actor.userId}, 'OPEN', ${now}, ${now})
    `)
    for (const [userId, role] of [[actor.userId, 'ADMIN'], [target.id, 'MEMBER']] as const) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO wewed_communications."CommunicationParticipant"
          (id, "conversationId", "userId", role, "joinedAt", "lastReadAt", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${conversationId}, ${userId}, ${role}, ${now}, ${userId === actor.userId ? now : null}, ${now}, ${now})
      `)
    }
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO wewed_communications."CommunicationEvent"
        (id, "conversationId", "actorUserId", "eventType", metadata)
      VALUES (
        ${randomUUID()}, ${conversationId}, ${actor.userId}, 'conversation_created',
        ${JSON.stringify({
          kind: 'DIRECT',
          type: conversationType,
          participantCount: 2,
          source: 'provider_marketplace',
          actorRole: actor.role,
          weddingId: conversationWeddingId,
        })}::jsonb
      )
    `)
  })

  return { id: conversationId, reused: false }
}
