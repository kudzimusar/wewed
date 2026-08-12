import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import {
  APP_SESSION_COOKIE,
  createAppSessionToken,
  VENDOR_PORTFOLIO_SESSION_ID,
} from '@/lib/app-session'
import {
  listCommunicationConversations,
  requireCommunicationActor,
  sendCommunicationMessage,
  type CommunicationActor,
} from '@/lib/communications'
import {
  listEligibleVendorContacts,
  maybeCreateVendorMarketplaceConversation,
} from '@/lib/vendor-marketplace-communications'
import { db } from '@/lib/db'

const COUPLE_ID = 'vendor-comms-integration-couple'
const WEDDING_ID = 'vendor-comms-integration-wedding'
const COUPLE_USER_ID = 'vendor-comms-integration-couple-user'
const NON_OWNER_COUPLE_USER_ID = 'vendor-comms-integration-non-owner-user'
const PLANNER_USER_ID = 'vendor-comms-integration-planner-user'
const ADMIN_USER_ID = 'vendor-comms-integration-admin-user'
const VENDOR_USER_ID = 'vendor-comms-integration-vendor-user'
const VENDOR_BUSINESS_ID = 'vendor-comms-integration-business'
const PROVIDER_PROFILE_ID = 'vendor-comms-integration-profile'
const TEST_USER_IDS = [
  COUPLE_USER_ID,
  NON_OWNER_COUPLE_USER_ID,
  PLANNER_USER_ID,
  ADMIN_USER_ID,
  VENDOR_USER_ID,
]

function sessionRequest(input: {
  userId: string
  email: string
  role: 'admin' | 'couple' | 'planner' | 'vendor'
  coupleId: string | null
}) {
  const token = createAppSessionToken({
    userId: input.userId,
    authUserId: `auth-${input.userId}`,
    email: input.email,
    role: input.role,
    coupleId: input.coupleId,
    activeWeddingId: input.role === 'vendor' ? VENDOR_PORTFOLIO_SESSION_ID : WEDDING_ID,
  })
  return new NextRequest('http://localhost/api/communications', {
    headers: { cookie: `${APP_SESSION_COOKIE}=${token}` },
  })
}

async function actorFor(input: {
  userId: string
  email: string
  role: 'admin' | 'couple' | 'planner' | 'vendor'
  coupleId: string | null
}): Promise<CommunicationActor> {
  return requireCommunicationActor(sessionRequest(input))
}

async function cleanup() {
  await db.$executeRaw(Prisma.sql`
    DELETE FROM wewed_communications."CommunicationConversation"
    WHERE "createdByUserId" IN (${Prisma.join(TEST_USER_IDS)})
  `)
  await db.weddingMembership.deleteMany({ where: { userId: { in: TEST_USER_IDS } } })
  await db.$executeRaw(Prisma.sql`
    DELETE FROM public."ProviderProfile" WHERE id = ${PROVIDER_PROFILE_ID}
  `)
  await db.$executeRaw(Prisma.sql`
    DELETE FROM public."BusinessAccountMember" WHERE "businessAccountId" = ${VENDOR_BUSINESS_ID}
  `)
  await db.$executeRaw(Prisma.sql`
    DELETE FROM public."BusinessAccount" WHERE id = ${VENDOR_BUSINESS_ID}
  `)
  await db.user.deleteMany({ where: { id: { in: TEST_USER_IDS } } })
  await db.wedding.deleteMany({ where: { id: WEDDING_ID } })
  await db.couple.deleteMany({ where: { id: COUPLE_ID } })
}

describe('Vendor marketplace communications authorization', () => {
  let coupleActor: CommunicationActor
  let nonOwnerActor: CommunicationActor
  let plannerActor: CommunicationActor
  let adminActor: CommunicationActor
  let vendorActor: CommunicationActor

  beforeAll(async () => {
    await cleanup()

    await db.couple.create({
      data: {
        id: COUPLE_ID,
        slug: 'vendor-comms-integration-couple',
        partner1: 'Couple',
        partner2: 'Owner',
      },
    })
    await db.wedding.create({
      data: {
        id: WEDDING_ID,
        slug: 'vendor-comms-integration-wedding',
        title: 'Vendor Communications Wedding',
        date: new Date('2027-06-01T10:00:00.000Z'),
        venue: 'Test Venue',
        venueCity: 'Harare',
        venueCountry: 'Zimbabwe',
        coupleId: COUPLE_ID,
      },
    })
    await db.user.createMany({
      data: [
        {
          id: COUPLE_USER_ID,
          email: 'vendor-comms-couple@example.test',
          name: 'Couple Owner',
          role: 'couple',
          coupleId: COUPLE_ID,
          currentWeddingId: WEDDING_ID,
          isActive: true,
        },
        {
          id: NON_OWNER_COUPLE_USER_ID,
          email: 'vendor-comms-viewer@example.test',
          name: 'Couple Viewer',
          role: 'couple',
          coupleId: COUPLE_ID,
          currentWeddingId: WEDDING_ID,
          isActive: true,
        },
        {
          id: PLANNER_USER_ID,
          email: 'vendor-comms-planner@example.test',
          name: 'Planner User',
          role: 'planner',
          currentWeddingId: WEDDING_ID,
          isActive: true,
        },
        {
          id: ADMIN_USER_ID,
          email: 'vendor-comms-admin@example.test',
          name: 'Admin User',
          role: 'admin',
          currentWeddingId: WEDDING_ID,
          isActive: true,
        },
        {
          id: VENDOR_USER_ID,
          email: 'vendor-comms-vendor@example.test',
          name: 'Vendor Owner',
          role: 'vendor',
          isActive: true,
        },
      ],
    })
    await db.weddingMembership.createMany({
      data: [
        {
          id: 'vendor-comms-owner-membership',
          userId: COUPLE_USER_ID,
          weddingId: WEDDING_ID,
          role: 'owner',
          status: 'active',
          permissions: JSON.stringify(['*']),
        },
        {
          id: 'vendor-comms-viewer-membership',
          userId: NON_OWNER_COUPLE_USER_ID,
          weddingId: WEDDING_ID,
          role: 'viewer',
          status: 'active',
        },
      ],
    })
    await db.$executeRaw(Prisma.sql`
      INSERT INTO public."BusinessAccount"
        (id, name, slug, type, status, "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "createdAt", "updatedAt")
      VALUES
        (${VENDOR_BUSINESS_ID}, 'Vendor Integration Business', 'vendor-integration-business', 'vendor', 'active', 'complete', 'free', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    await db.$executeRaw(Prisma.sql`
      INSERT INTO public."BusinessAccountMember"
        (id, "businessAccountId", "userId", role, status, "createdAt", "updatedAt")
      VALUES
        ('vendor-comms-integration-member', ${VENDOR_BUSINESS_ID}, ${VENDOR_USER_ID}, 'business_owner', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    await db.$executeRaw(Prisma.sql`
      INSERT INTO public."ProviderProfile"
        (id, "businessAccountId", slug, "displayName", visibility, "listingStatus", "isClaimable", "acceptingEnquiries", "verificationBadges", "createdAt", "updatedAt")
      VALUES
        (${PROVIDER_PROFILE_ID}, ${VENDOR_BUSINESS_ID}, 'vendor-integration-business', 'Vendor Integration Business', 'published', 'verified', false, true, '["Wewed Approved"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)

    coupleActor = await actorFor({
      userId: COUPLE_USER_ID,
      email: 'vendor-comms-couple@example.test',
      role: 'couple',
      coupleId: COUPLE_ID,
    })
    nonOwnerActor = await actorFor({
      userId: NON_OWNER_COUPLE_USER_ID,
      email: 'vendor-comms-viewer@example.test',
      role: 'couple',
      coupleId: COUPLE_ID,
    })
    plannerActor = await actorFor({
      userId: PLANNER_USER_ID,
      email: 'vendor-comms-planner@example.test',
      role: 'planner',
      coupleId: null,
    })
    adminActor = await actorFor({
      userId: ADMIN_USER_ID,
      email: 'vendor-comms-admin@example.test',
      role: 'admin',
      coupleId: null,
    })
    vendorActor = await actorFor({
      userId: VENDOR_USER_ID,
      email: 'vendor-comms-vendor@example.test',
      role: 'vendor',
      coupleId: null,
    })
  })

  afterAll(async () => {
    await cleanup()
  })

  it('exposes approved enquiry-ready Vendors to an active Couple owner', async () => {
    const contacts = await listEligibleVendorContacts(coupleActor)
    expect(contacts).toContainEqual(expect.objectContaining({
      id: VENDOR_USER_ID,
      name: 'Vendor Integration Business',
      role: 'vendor',
      defaultType: 'MARKETPLACE',
    }))
  })

  it('creates and reuses one wedding-scoped Couple Vendor marketplace conversation', async () => {
    const created = await maybeCreateVendorMarketplaceConversation(coupleActor, {
      participantIds: [VENDOR_USER_ID],
      type: 'MARKETPLACE',
      weddingId: WEDDING_ID,
    })
    expect(created).toMatchObject({ reused: false })
    expect(created?.id).toBeTruthy()

    const row = await db.$queryRaw<Array<{ type: string; weddingId: string | null }>>(Prisma.sql`
      SELECT type, "weddingId" FROM wewed_communications."CommunicationConversation"
      WHERE id = ${created?.id ?? ''}
    `)
    expect(row[0]).toEqual({ type: 'MARKETPLACE', weddingId: WEDDING_ID })

    const reused = await maybeCreateVendorMarketplaceConversation(coupleActor, {
      participantIds: [VENDOR_USER_ID],
      type: 'MARKETPLACE',
    })
    expect(reused).toEqual({ id: created?.id, reused: true })

    await sendCommunicationMessage(coupleActor, created!.id, {
      body: 'Couple Vendor integration enquiry',
    })
    const vendorInbox = await listCommunicationConversations(vendorActor)
    expect(vendorInbox).toContainEqual(expect.objectContaining({
      id: created?.id,
      type: 'MARKETPLACE',
      weddingId: WEDDING_ID,
      unreadCount: 1,
    }))
  })

  it('does not expose or create Vendor marketplace conversations for a non-owner Couple member', async () => {
    await expect(listEligibleVendorContacts(nonOwnerActor)).resolves.toEqual([])
    await expect(
      maybeCreateVendorMarketplaceConversation(nonOwnerActor, {
        participantIds: [VENDOR_USER_ID],
        type: 'MARKETPLACE',
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('preserves Planner Vendor marketplace scope and gives Admin Vendor support scope', async () => {
    const plannerConversation = await maybeCreateVendorMarketplaceConversation(plannerActor, {
      participantIds: [VENDOR_USER_ID],
      type: 'MARKETPLACE',
    })
    const adminConversation = await maybeCreateVendorMarketplaceConversation(adminActor, {
      participantIds: [VENDOR_USER_ID],
      type: 'SUPPORT',
    })

    const rows = await db.$queryRaw<Array<{ id: string; type: string; weddingId: string | null }>>(Prisma.sql`
      SELECT id, type, "weddingId"
      FROM wewed_communications."CommunicationConversation"
      WHERE id IN (${Prisma.join([plannerConversation!.id, adminConversation!.id])})
      ORDER BY type ASC
    `)
    expect(rows).toEqual(expect.arrayContaining([
      { id: plannerConversation!.id, type: 'MARKETPLACE', weddingId: null },
      { id: adminConversation!.id, type: 'SUPPORT', weddingId: null },
    ]))
  })
})
