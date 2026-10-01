import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
}
mock.module('server-only', () => ({}))

type Db = typeof import('@/lib/db')['db']
let db: Db
let createServiceTeam: typeof import('@/lib/service-team-operations')['createServiceTeam']
let addServiceTeamMember: typeof import('@/lib/service-team-operations')['addServiceTeamMember']
let submitServiceTeam: typeof import('@/lib/service-team-operations')['submitServiceTeam']
let approveServiceTeam: typeof import('@/lib/service-team-operations')['approveServiceTeam']
let loadServiceTeamOperations: typeof import('@/lib/service-team-operations')['loadServiceTeamOperations']
let recordGuestNativePresence: typeof import('@/lib/guest-native-presence')['recordGuestNativePresence']

const suffix = randomUUID().slice(0, 8)
let coupleId = ''
let weddingId = ''
let actorId = ''
let vendorId = ''
let engagementId = ''
let teamId = ''

describe.skipIf(!isLocal)('Service-provider teams against disposable PostgreSQL', () => {
  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({
      createServiceTeam,
      addServiceTeamMember,
      submitServiceTeam,
      approveServiceTeam,
      loadServiceTeamOperations,
    } = await import('@/lib/service-team-operations'))
    ;({ recordGuestNativePresence } = await import('@/lib/guest-native-presence'))

    const couple = await db.couple.create({
      data: { slug: `service-team-${suffix}`, partner1: 'Service', partner2: 'Team' },
    })
    coupleId = couple.id

    const wedding = await db.wedding.create({
      data: {
        slug: `service-team-wedding-${suffix}`,
        title: 'Service Team UAT',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        venue: 'Disposable Venue',
        venueCity: 'Harare',
        venueCountry: 'Zimbabwe',
        coupleId,
      },
    })
    weddingId = wedding.id

    const actor = await db.user.create({
      data: { email: `service-team-${suffix}@example.com`, name: 'Service Team UAT Actor', role: 'planner' },
    })
    actorId = actor.id

    const vendor = await db.vendor.create({
      data: {
        weddingId,
        name: 'Disposable Photography Co',
        category: 'Photography',
      },
    })
    vendorId = vendor.id

    const engagement = await db.serviceEngagement.create({
      data: {
        weddingId,
        vendorId,
        serviceCategory: 'Photography',
      },
    })
    engagementId = engagement.id

    const team = await createServiceTeam({
      weddingId,
      actorId,
      serviceEngagementId: engagementId,
      name: 'Photography Crew',
      allowedCrew: 2,
    })
    teamId = team.id
  })

  afterAll(async () => {
    if (!db || !weddingId) return
    await db.auditEvent.deleteMany({ where: { weddingId } })
    await db.guestNativePresence.deleteMany({ where: { weddingId } })
    await db.rSVP.deleteMany({ where: { guest: { weddingId } } })
    await db.serviceTeamMember.deleteMany({ where: { weddingId } })
    await db.guest.deleteMany({ where: { weddingId } })
    await db.serviceTeam.deleteMany({ where: { weddingId } })
    await db.serviceEngagement.deleteMany({ where: { weddingId } })
    await db.vendor.deleteMany({ where: { weddingId } })
    await db.wedding.delete({ where: { id: weddingId } })
    await db.user.delete({ where: { id: actorId } })
    await db.couple.delete({ where: { id: coupleId } })
  })

  test('two allowed crew become two named canonical Guests and a third cannot be added', async () => {
    const lead = await addServiceTeamMember({
      weddingId,
      actorId,
      serviceTeamId: teamId,
      name: 'Lead Photographer',
      email: `lead-${suffix}@example.com`,
      function: 'Lead Photographer',
      isLeader: true,
    })
    expect(lead.ok).toBe(true)

    const assistant = await addServiceTeamMember({
      weddingId,
      actorId,
      serviceTeamId: teamId,
      name: 'Assistant Photographer',
      email: `assistant-${suffix}@example.com`,
      function: 'Assistant Photographer',
    })
    expect(assistant.ok).toBe(true)

    await expect(
      addServiceTeamMember({
        weddingId,
        actorId,
        serviceTeamId: teamId,
        name: 'Anonymous Extra',
        function: 'Extra',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_TEAM_CREW_LIMIT_EXCEEDED',
      status: 409,
    })

    const guests = await db.guest.findMany({
      where: { weddingId, role: 'service_provider' },
      orderBy: { name: 'asc' },
    })
    expect(guests).toHaveLength(2)
    expect(guests.every((guest) => guest.attendanceAllocation === 'operational')).toBe(true)

    const memberships = await db.serviceTeamMember.findMany({ where: { weddingId, serviceTeamId: teamId } })
    expect(memberships).toHaveLength(2)
    expect(new Set(memberships.map((member) => member.guestId)).size).toBe(2)
  })

  test('submitted + approved roster projects confirmed/app-active/arrived per named member', async () => {
    await submitServiceTeam({ weddingId, serviceTeamId: teamId, actorId })
    await approveServiceTeam({ weddingId, serviceTeamId: teamId, actorId })

    const members = await db.serviceTeamMember.findMany({
      where: { weddingId, serviceTeamId: teamId },
      orderBy: { createdAt: 'asc' },
    })
    expect(members).toHaveLength(2)

    await db.rSVP.update({
      where: { guestId: members[0].guestId },
      data: { attending: true, checkedIn: true, checkedInAt: new Date() },
    })
    await db.rSVP.update({
      where: { guestId: members[1].guestId },
      data: { attending: true },
    })

    await recordGuestNativePresence({
      weddingId,
      guestId: members[0].guestId,
      headers: new Headers({
        'x-wewed-client': 'native',
        'x-wewed-native-platform': 'android',
        'x-wewed-app-version': '2.0.0',
        'x-wewed-build-version': '200',
      }),
    })

    const projection = await loadServiceTeamOperations(weddingId)
    expect(projection).not.toBeNull()
    const team = projection?.teams.find((row) => row.id === teamId)
    expect(team).toMatchObject({
      allowedCrew: 2,
      registered: 2,
      submitted: 2,
      approved: 2,
      confirmed: 2,
      appActive: 1,
      passReady: 2,
      arrived: 1,
      missing: 1,
    })
    expect(team?.members.every((member) => member.participantType === 'service_provider')).toBe(true)
    expect(team?.members.map((member) => member.guestId)).toHaveLength(2)
    expect(team?.members.filter((member) => member.appActive).map((member) => member.nativePlatforms)).toEqual([['android']])
  })
})
