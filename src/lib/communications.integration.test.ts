import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { APP_SESSION_COOKIE, createAppSessionToken } from '@/lib/app-session'
import {
  createCommunicationConversation,
  getCommunicationUnread,
  listCommunicationContacts,
  listCommunicationConversations,
  listCommunicationMessages,
  markCommunicationRead,
  requireCommunicationActor,
  sendCommunicationMessage,
  type CommunicationActor,
} from '@/lib/communications'
import { db } from '@/lib/db'

const COUPLE_ID = 'communications-integration-couple'
const WEDDING_ID = 'communications-integration-wedding'
const COUPLE_USER_ID = 'communications-integration-couple-user'
const PLANNER_USER_ID = 'communications-integration-planner-user'
const SECOND_PLANNER_USER_ID = 'communications-integration-second-planner-user'
const OUTSIDER_USER_ID = 'communications-integration-outsider-user'
const ADMIN_USER_ID = 'communications-integration-admin-user'
const PLANNER_BUSINESS_ID = 'communications-integration-planner-business'
const SECOND_PLANNER_BUSINESS_ID = 'communications-integration-second-planner-business'
const TEST_USER_IDS = [
  COUPLE_USER_ID,
  PLANNER_USER_ID,
  SECOND_PLANNER_USER_ID,
  OUTSIDER_USER_ID,
  ADMIN_USER_ID,
]
const TEST_BUSINESS_IDS = [PLANNER_BUSINESS_ID, SECOND_PLANNER_BUSINESS_ID]

function sessionRequest(input: {
  userId: string
  email: string
  role: 'admin' | 'couple' | 'planner'
  coupleId: string | null
}) {
  const token = createAppSessionToken({
    userId: input.userId,
    authUserId: `auth-${input.userId}`,
    email: input.email,
    role: input.role,
    coupleId: input.coupleId,
    activeWeddingId: WEDDING_ID,
  })
  return new NextRequest('http://localhost/api/communications', {
    headers: { cookie: `${APP_SESSION_COOKIE}=${token}` },
  })
}

async function actorFor(input: {
  userId: string
  email: string
  role: 'admin' | 'couple' | 'planner'
  coupleId: string | null
}): Promise<CommunicationActor> {
  return requireCommunicationActor(sessionRequest(input))
}

async function cleanup() {
  await db.$executeRaw(Prisma.sql`
    DELETE FROM wewed_communications."CommunicationConversation"
    WHERE "createdByUserId" IN (${Prisma.join(TEST_USER_IDS)})
  `)
  await db.weddingMembership.deleteMany({
    where: { userId: { in: TEST_USER_IDS } },
  })
  await db.$executeRaw(Prisma.sql`
    DELETE FROM public."BusinessAccount"
    WHERE "id" IN (${Prisma.join(TEST_BUSINESS_IDS)})
  `)
  await db.user.deleteMany({
    where: { id: { in: TEST_USER_IDS } },
  })
  await db.wedding.deleteMany({ where: { id: WEDDING_ID } })
  await db.couple.deleteMany({ where: { id: COUPLE_ID } })
}

describe('communications integration authorization', () => {
  let coupleActor: CommunicationActor
  let plannerActor: CommunicationActor
  let secondPlannerActor: CommunicationActor
  let outsiderActor: CommunicationActor
  let adminActor: CommunicationActor
  let plannerConversationId = ''

  beforeAll(async () => {
    await cleanup()

    await db.couple.create({
      data: {
        id: COUPLE_ID,
        slug: 'communications-integration-couple',
        partner1: 'Test',
        partner2: 'Couple',
      },
    })
    await db.wedding.create({
      data: {
        id: WEDDING_ID,
        slug: 'communications-integration-wedding',
        title: 'Communications Integration Wedding',
        date: new Date('2027-01-01T10:00:00.000Z'),
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
          email: 'communications-couple@example.test',
          name: 'Couple Test',
          role: 'couple',
          coupleId: COUPLE_ID,
          currentWeddingId: WEDDING_ID,
          isActive: true,
        },
        {
          id: PLANNER_USER_ID,
          email: 'communications-planner@example.test',
          name: 'Planner Personal Name',
          role: 'planner',
          currentWeddingId: WEDDING_ID,
          isActive: true,
        },
        {
          id: SECOND_PLANNER_USER_ID,
          email: 'communications-second-planner@example.test',
          name: 'Second Planner Personal Name',
          role: 'planner',
          currentWeddingId: WEDDING_ID,
          isActive: true,
        },
        {
          id: OUTSIDER_USER_ID,
          email: 'communications-outsider@example.test',
          name: 'Outsider Planner',
          role: 'planner',
          currentWeddingId: WEDDING_ID,
          isActive: true,
        },
        {
          id: ADMIN_USER_ID,
          email: 'communications-admin@example.test',
          name: 'Admin Test',
          role: 'admin',
          currentWeddingId: WEDDING_ID,
          isActive: true,
        },
      ],
    })
    await db.$executeRaw(Prisma.sql`
      INSERT INTO public."BusinessAccount"
        ("id", "name", "slug", "type", "status", "ownerUserId", "onboardingStatus", "subscriptionStatus")
      VALUES
        (${PLANNER_BUSINESS_ID}, 'Planner Business Name', 'communications-integration-planner-business', 'planning_company', 'active', ${PLANNER_USER_ID}, 'complete', 'free'),
        (${SECOND_PLANNER_BUSINESS_ID}, 'Second Planner Business', 'communications-integration-second-planner-business', 'planning_company', 'active', ${SECOND_PLANNER_USER_ID}, 'complete', 'free')
    `)
    await db.$executeRaw(Prisma.sql`
      INSERT INTO public."BusinessAccountMember"
        ("id", "businessAccountId", "userId", "role", "status")
      VALUES
        ('communications-integration-planner-business-member', ${PLANNER_BUSINESS_ID}, ${PLANNER_USER_ID}, 'business_owner', 'active'),
        ('communications-integration-second-planner-business-member', ${SECOND_PLANNER_BUSINESS_ID}, ${SECOND_PLANNER_USER_ID}, 'business_owner', 'active')
    `)
    await db.weddingMembership.create({
      data: {
        id: 'communications-integration-planner-membership',
        userId: PLANNER_USER_ID,
        weddingId: WEDDING_ID,
        role: 'planner',
        status: 'active',
      },
    })

    coupleActor = await actorFor({
      userId: COUPLE_USER_ID,
      email: 'communications-couple@example.test',
      role: 'couple',
      coupleId: COUPLE_ID,
    })
    plannerActor = await actorFor({
      userId: PLANNER_USER_ID,
      email: 'communications-planner@example.test',
      role: 'planner',
      coupleId: null,
    })
    secondPlannerActor = await actorFor({
      userId: SECOND_PLANNER_USER_ID,
      email: 'communications-second-planner@example.test',
      role: 'planner',
      coupleId: null,
    })
    outsiderActor = await actorFor({
      userId: OUTSIDER_USER_ID,
      email: 'communications-outsider@example.test',
      role: 'planner',
      coupleId: null,
    })
    adminActor = await actorFor({
      userId: ADMIN_USER_ID,
      email: 'communications-admin@example.test',
      role: 'admin',
      coupleId: null,
    })
  })

  afterAll(async () => {
    await cleanup()
  })

  it('rejects an unsigned request before database conversation access', async () => {
    await expect(
      requireCommunicationActor(new NextRequest('http://localhost/api/communications')),
    ).rejects.toMatchObject({ status: 401 })
  })

  it('creates and reuses a planner-client direct conversation', async () => {
    const created = await createCommunicationConversation(coupleActor, {
      participantIds: [PLANNER_USER_ID],
      type: 'PLANNER_CLIENT',
      initialMessage: 'Hello planner',
    })
    expect(created.reused).toBe(false)
    plannerConversationId = created.id

    const reused = await createCommunicationConversation(coupleActor, {
      participantIds: [PLANNER_USER_ID],
      type: 'PLANNER_CLIENT',
    })
    expect(reused).toEqual({ id: created.id, reused: true })
  })

  it('keeps a non-member out even when the conversation id is known', async () => {
    const outsiderInbox = await listCommunicationConversations(outsiderActor)
    expect(outsiderInbox).toHaveLength(0)

    await expect(
      listCommunicationMessages(outsiderActor, plannerConversationId),
    ).rejects.toMatchObject({ status: 404 })

    await expect(
      sendCommunicationMessage(outsiderActor, plannerConversationId, {
        body: 'I should not be able to send this',
      }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('discovers registered planners platform-wide using their planning-company identity', async () => {
    const plannerContacts = await listCommunicationContacts(plannerActor)
    expect(plannerContacts).toContainEqual(expect.objectContaining({
      id: SECOND_PLANNER_USER_ID,
      name: 'Second Planner Business',
      role: 'planner',
      defaultType: 'DIRECT',
      context: 'wewed',
    }))

    const coupleContacts = await listCommunicationContacts(coupleActor)
    expect(coupleContacts.some((contact) => contact.id === SECOND_PLANNER_USER_ID)).toBe(false)
    expect(coupleContacts).toContainEqual(expect.objectContaining({
      id: PLANNER_USER_ID,
      name: 'Planner Business Name',
      role: 'planner',
      context: 'wedding',
    }))
  })

  it('creates and reuses a platform direct conversation between registered planners', async () => {
    const created = await createCommunicationConversation(plannerActor, {
      participantIds: [SECOND_PLANNER_USER_ID],
      type: 'DIRECT',
      initialMessage: 'Planner platform hello',
    })
    expect(created.reused).toBe(false)

    const secondPlannerInbox = await listCommunicationConversations(secondPlannerActor)
    const conversation = secondPlannerInbox.find((item) => item.id === created.id)
    expect(conversation).toMatchObject({
      type: 'DIRECT',
      weddingId: null,
      lastMessageSenderName: 'Planner Business Name',
    })
    expect(conversation?.participants).toContainEqual(expect.objectContaining({
      userId: PLANNER_USER_ID,
      name: 'Planner Business Name',
      role: 'planner',
    }))

    const reused = await createCommunicationConversation(secondPlannerActor, {
      participantIds: [PLANNER_USER_ID],
      type: 'DIRECT',
    })
    expect(reused).toEqual({ id: created.id, reused: true })
  })

  it('does not grant platform planner messaging to a role-only planner without an active planning company', async () => {
    await expect(
      createCommunicationConversation(outsiderActor, {
        participantIds: [SECOND_PLANNER_USER_ID],
        type: 'DIRECT',
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('tracks unread messages and clears them when the participant reads', async () => {
    const initialUnread = await getCommunicationUnread(plannerActor)
    expect(initialUnread.messageCount).toBe(1)
    expect(initialUnread.conversationCount).toBe(1)

    await markCommunicationRead(plannerActor, plannerConversationId)
    expect(await getCommunicationUnread(plannerActor)).toEqual({
      messageCount: 0,
      conversationCount: 0,
    })

    await sendCommunicationMessage(coupleActor, plannerConversationId, {
      body: 'A second message',
    })
    expect((await getCommunicationUnread(plannerActor)).messageCount).toBe(1)
  })

  it('keeps admin internal notes invisible to the couple', async () => {
    const support = await createCommunicationConversation(coupleActor, {
      participantIds: [ADMIN_USER_ID],
      type: 'SUPPORT',
      initialMessage: 'I need Wewed support',
    })

    await sendCommunicationMessage(adminActor, support.id, {
      body: 'This is a Wewed staff-only case note.',
      internalNote: true,
    })

    const coupleMessages = await listCommunicationMessages(coupleActor, support.id)
    expect(coupleMessages.some((message) => message.visibility === 'STAFF_ONLY')).toBe(false)
    expect(coupleMessages.some((message) => message.body.includes('staff-only'))).toBe(false)

    const adminMessages = await listCommunicationMessages(adminActor, support.id)
    expect(adminMessages.some((message) => message.visibility === 'STAFF_ONLY')).toBe(true)

    await expect(
      sendCommunicationMessage(coupleActor, support.id, {
        body: 'Forged internal note',
        internalNote: true,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('records analytics metadata without copying raw message bodies', async () => {
    const events = await db.$queryRaw<Array<{ metadata: Prisma.JsonValue }>>(Prisma.sql`
      SELECT "metadata"
      FROM wewed_communications."CommunicationEvent"
      WHERE "actorUserId" IN (${Prisma.join(TEST_USER_IDS)})
        AND "eventType" = 'message_sent'
    `)

    expect(events.length).toBeGreaterThan(0)
    for (const event of events) {
      expect(event.metadata && typeof event.metadata === 'object').toBe(true)
      if (event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)) {
        expect(Object.prototype.hasOwnProperty.call(event.metadata, 'body')).toBe(false)
      }
    }
  })
})
