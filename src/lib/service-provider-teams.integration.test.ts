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
let createPlannerGuest: typeof import('@/lib/planner-guest-operations')['createPlannerGuest']
let updatePlannerGuest: typeof import('@/lib/planner-guest-operations')['updatePlannerGuest']
let applyGuestRsvpUpdate: typeof import('@/lib/guest-rsvp-mutation')['applyGuestRsvpUpdate']

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
    ;({ createPlannerGuest, updatePlannerGuest } = await import('@/lib/planner-guest-operations'))
    ;({ applyGuestRsvpUpdate } = await import('@/lib/guest-rsvp-mutation'))

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

  test('duplicate team names return a deliberate 409 domain conflict', async () => {
    await expect(
      createServiceTeam({
        weddingId,
        actorId,
        serviceEngagementId: engagementId,
        name: 'Photography Crew',
        allowedCrew: 2,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_TEAM_ALREADY_EXISTS',
      status: 409,
    })
  })

  test('generic Guest writes cannot manufacture or shed service-provider admission identity', async () => {
    const genericProvider = await createPlannerGuest(
      { weddingId, actorId },
      { name: 'Generic Provider Bypass', role: 'service_provider' },
    )
    expect(genericProvider).toMatchObject({ ok: false, status: 400, field: 'role' })
    expect(await db.guest.count({ where: { weddingId, name: 'Generic Provider Bypass' } })).toBe(0)
  })

  test('named crew are capacity-bounded, approved individually, and projected for event-day roll-call', async () => {
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

    const memberships = await db.serviceTeamMember.findMany({
      where: { weddingId, serviceTeamId: teamId },
      orderBy: { createdAt: 'asc' },
    })
    expect(memberships).toHaveLength(2)
    expect(new Set(memberships.map((member) => member.guestId)).size).toBe(2)

    const roleBypass = await updatePlannerGuest(
      { weddingId, actorId },
      memberships[0].guestId,
      { role: 'guest' },
    )
    expect(roleBypass).toMatchObject({ ok: false, status: 409, field: 'role' })
    const allocationBypass = await updatePlannerGuest(
      { weddingId, actorId },
      memberships[0].guestId,
      { attendanceAllocation: 'shared' },
    )
    expect(allocationBypass).toMatchObject({
      ok: false,
      status: 409,
      field: 'attendanceAllocation',
    })
    const protectedProvider = await db.guest.findUniqueOrThrow({
      where: { id: memberships[0].guestId },
      select: { role: true, attendanceAllocation: true },
    })
    expect(protectedProvider).toEqual({
      role: 'service_provider',
      attendanceAllocation: 'operational',
    })

    // Migration/backward safety: even if a historical row already contains stale role text from
    // before the write guard existed, the canonical ServiceTeamMember relationship remains the
    // server authority for professional household restrictions.
    await db.guest.update({
      where: { id: memberships[0].guestId },
      data: { role: 'guest' },
    })
    const staleRoleRsvp = await db.rSVP.findUniqueOrThrow({
      where: { guestId: memberships[0].guestId },
      select: { token: true },
    })
    const staleRoleBypass = await applyGuestRsvpUpdate({
      weddingId,
      rsvpToken: staleRoleRsvp.token,
      requestedFields: { plusOne: true },
    })
    expect(staleRoleBypass).toMatchObject({
      ok: false,
      status: 400,
      code: 'SERVICE_PROVIDER_HOUSEHOLD_NOT_ALLOWED',
    })

    await submitServiceTeam({ weddingId, serviceTeamId: teamId, actorId })
    await approveServiceTeam({ weddingId, serviceTeamId: teamId, actorId })

    await db.rSVP.update({
      where: { guestId: memberships[0].guestId },
      data: { attending: true, checkedIn: true, checkedInAt: new Date() },
    })
    await db.rSVP.update({
      where: { guestId: memberships[1].guestId },
      data: { attending: true },
    })

    await recordGuestNativePresence({
      weddingId,
      guestId: memberships[0].guestId,
      headers: new Headers({
        'user-agent': 'Wewed-Android/2.0.0',
        'x-wewed-client': 'native',
        'x-wewed-native-platform': 'android',
        'x-wewed-native-runtime': 'android-httpurlconnection',
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
