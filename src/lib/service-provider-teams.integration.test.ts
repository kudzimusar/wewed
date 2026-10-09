import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
// Moderator exact-head verification trigger for Agent B identity hardening.
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

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
let loadPlannerInvitationProjection: typeof import('@/lib/planner-invitation-projection')['loadPlannerInvitationProjection']
let createWeddingGuestSessionToken: typeof import('@/lib/wedding-guest-session')['createWeddingGuestSessionToken']
let WEDDING_GUEST_SESSION_COOKIE: typeof import('@/lib/wedding-guest-session')['WEDDING_GUEST_SESSION_COOKIE']
let getGuestSession: typeof import('@/app/api/weddings/[slug]/guest-session/route')['GET']

const suffix = randomUUID().slice(0, 8)
let coupleId = ''
let weddingId = ''
let actorId = ''
let vendorId = ''
let engagementId = ''
let teamId = ''
let weddingDate = new Date(0)

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
    ;({ loadPlannerInvitationProjection } = await import('@/lib/planner-invitation-projection'))
    ;({ createWeddingGuestSessionToken, WEDDING_GUEST_SESSION_COOKIE } = await import('@/lib/wedding-guest-session'))
    ;({ GET: getGuestSession } = await import('@/app/api/weddings/[slug]/guest-session/route'))

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
    weddingDate = wedding.date

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

  test('legacy service-provider Guest is adopted into a roster without duplicate identity', async () => {
    const legacyEmail = `legacy-provider-${suffix}@example.com`
    const legacyGuest = await db.guest.create({
      data: {
        weddingId,
        name: 'Legacy Provider',
        email: legacyEmail,
        role: 'service_provider',
        attendanceAllocation: 'shared',
      },
    })
    const legacyRsvp = await db.rSVP.create({
      data: {
        guestId: legacyGuest.id,
        token: `legacy-provider-${suffix}`,
        attending: true,
      },
    })
    const legacyTeam = await createServiceTeam({
      weddingId,
      actorId,
      serviceEngagementId: engagementId,
      name: 'Legacy Provider Crew',
      allowedCrew: 1,
    })

    const adopted = await addServiceTeamMember({
      weddingId,
      actorId,
      serviceTeamId: legacyTeam.id,
      name: legacyGuest.name,
      email: legacyEmail,
      function: 'Legacy service provider',
    })
    expect(adopted.ok).toBe(true)
    expect(adopted.data.id).toBe(legacyGuest.id)
    expect(adopted.data.rsvp?.token).toBe(legacyRsvp.token)
    expect(adopted.data.attendanceAllocation).toBe('operational')
    expect(
      await db.guest.count({
        where: { weddingId, email: { equals: legacyEmail, mode: 'insensitive' } },
      }),
    ).toBe(1)
    expect(
      await db.serviceTeamMember.findUnique({
        where: {
          weddingId_guestId: {
            weddingId,
            guestId: legacyGuest.id,
          },
        },
      }),
    ).toMatchObject({
      guestId: legacyGuest.id,
      serviceTeamId: legacyTeam.id,
    })

    // Keep this compatibility fixture isolated from the shared-wedding roll-call scenario below.
    await db.serviceTeamMember.deleteMany({ where: { guestId: legacyGuest.id } })
    await db.auditEvent.deleteMany({
      where: {
        weddingId,
        resourceId: legacyGuest.id,
        action: 'service_team.member_adopted',
      },
    })
    await db.rSVP.delete({ where: { id: legacyRsvp.id } })
    await db.guest.delete({ where: { id: legacyGuest.id } })
    await db.serviceTeam.delete({ where: { id: legacyTeam.id } })
  })

  test('legacy provider adoption refuses ambiguous exact-email identity instead of picking an arbitrary Guest', async () => {
    const ambiguousEmail = `ambiguous-provider-${suffix}@example.com`
    const first = await db.guest.create({
      data: {
        weddingId,
        name: 'Ambiguous Provider One',
        email: ambiguousEmail,
        role: 'service_provider',
        attendanceAllocation: 'shared',
      },
    })
    const second = await db.guest.create({
      data: {
        weddingId,
        name: 'Ambiguous Provider Two',
        email: ambiguousEmail,
        role: 'service_provider',
        attendanceAllocation: 'shared',
      },
    })
    const ambiguousTeam = await createServiceTeam({
      weddingId,
      actorId,
      serviceEngagementId: engagementId,
      name: 'Ambiguous Provider Crew',
      allowedCrew: 1,
    })

    await expect(
      addServiceTeamMember({
        weddingId,
        actorId,
        serviceTeamId: ambiguousTeam.id,
        name: 'Ambiguous Provider',
        email: ambiguousEmail,
        function: 'Ambiguous legacy service provider',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_TEAM_MEMBER_CONFLICT',
      status: 409,
    })

    expect(
      await db.serviceTeamMember.count({
        where: {
          weddingId,
          guestId: { in: [first.id, second.id] },
        },
      }),
    ).toBe(0)
    expect(
      await db.guest.count({
        where: {
          weddingId,
          email: { equals: ambiguousEmail, mode: 'insensitive' },
        },
      }),
    ).toBe(2)

    await db.guest.deleteMany({ where: { id: { in: [first.id, second.id] } } })
    await db.serviceTeam.delete({ where: { id: ambiguousTeam.id } })
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
    const staleRoleEditorBypass = await updatePlannerGuest(
      { weddingId, actorId },
      memberships[0].guestId,
      { role: 'guest', attendanceAllocation: 'shared' },
    )
    expect(staleRoleEditorBypass).toMatchObject({
      ok: false,
      status: 409,
      field: 'role',
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
    const attendingBeforeApproval = await applyGuestRsvpUpdate({
      weddingId,
      rsvpToken: staleRoleRsvp.token,
      requestedFields: { attending: true },
    })
    expect(attendingBeforeApproval.ok).toBe(true)
    const beforeApprovalProjection = await loadPlannerInvitationProjection(
      weddingId,
      'https://wewed.pro',
    )
    const staleRoleGuest = beforeApprovalProjection?.data.find(
      (guest) => guest.id === memberships[0].guestId,
    )
    expect(staleRoleGuest).toMatchObject({
      status: 'attending',
      passState: 'not_yet_issuable',
    })

    await db.rSVP.update({
      where: { guestId: memberships[0].guestId },
      data: {
        plusOne: true,
        plusOneName: 'Historical Provider +1',
        kidsAttending: true,
        kidsCount: 2,
      },
    })
    const guestSession = createWeddingGuestSessionToken({
      weddingId,
      guestId: memberships[0].guestId,
      rsvpToken: staleRoleRsvp.token,
      weddingDate,
    })
    const guestSessionResponse = await getGuestSession(
      new NextRequest(
        `http://localhost/api/weddings/service-team-wedding-${suffix}/guest-session`,
        { headers: { cookie: `${WEDDING_GUEST_SESSION_COOKIE}=${guestSession}` } },
      ),
      { params: Promise.resolve({ slug: `service-team-wedding-${suffix}` }) },
    )
    expect(guestSessionResponse.status).toBe(200)
    const guestSessionBody = await guestSessionResponse.json()
    expect(guestSessionBody.guest).toMatchObject({
      id: memberships[0].guestId,
      role: 'service_provider',
    })
    expect(guestSessionBody.rsvp).toMatchObject({
      plusOne: false,
      kidsAttending: false,
      partySize: 1,
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
