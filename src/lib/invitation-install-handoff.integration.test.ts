import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import {
  consumeInvitationInstallHandoff,
  createInvitationInstallHandoff,
} from '@/lib/invitation-install-handoff'

type Fixture = {
  coupleId: string
  weddingId: string
  weddingSlug: string
  guestId: string
  rsvpId: string
  rsvpToken: string
}

const fixtures: Fixture[] = []

function secretFromPlayUrl(playStoreUrl: string): string {
  const playUrl = new URL(playStoreUrl)
  const referrer = playUrl.searchParams.get('referrer')
  if (!referrer) throw new Error('Play URL is missing referrer')
  const handoff = new URLSearchParams(referrer).get('handoff')
  if (!handoff) throw new Error('Play referrer is missing handoff')
  return handoff
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID().replaceAll('-', '')
  const couple = await db.couple.create({
    data: {
      slug: `handoff-couple-${suffix}`,
      partner1: 'Mobile',
      partner2: 'Guest',
    },
  })
  const wedding = await db.wedding.create({
    data: {
      slug: `handoff-wedding-${suffix}`,
      title: 'Deferred Invitation Test Wedding',
      date: new Date('2030-06-20T10:00:00.000Z'),
      venue: 'Test Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      coupleId: couple.id,
    },
  })
  const guest = await db.guest.create({
    data: {
      name: 'Install Referrer Guest',
      weddingId: wedding.id,
    },
  })
  const rsvpToken = `uat-${suffix}`
  const rsvp = await db.rSVP.create({
    data: {
      token: rsvpToken,
      guestId: guest.id,
    },
  })

  const fixture = {
    coupleId: couple.id,
    weddingId: wedding.id,
    weddingSlug: wedding.slug,
    guestId: guest.id,
    rsvpId: rsvp.id,
    rsvpToken,
  }
  fixtures.push(fixture)
  return fixture
}

async function makeHandoff(fixture: Fixture) {
  const created = await createInvitationInstallHandoff({
    weddingId: fixture.weddingId,
    guestId: fixture.guestId,
    rsvpToken: fixture.rsvpToken,
    card: 'botanical',
    source: 'integration-test',
    ipAddress: '192.0.2.10',
    userAgent: 'Wewed integration test',
  })
  return { ...created, secret: secretFromPlayUrl(created.playStoreUrl) }
}

afterEach(async () => {
  while (fixtures.length) {
    const fixture = fixtures.pop()!
    await db.auditEvent.deleteMany({ where: { weddingId: fixture.weddingId } })
    await db.$executeRaw`
      DELETE FROM private."InvitationInstallHandoff"
      WHERE "weddingId" = ${fixture.weddingId}
    `
    await db.rSVP.deleteMany({ where: { guestId: fixture.guestId } })
    await db.guest.deleteMany({ where: { id: fixture.guestId } })
    await db.wedding.deleteMany({ where: { id: fixture.weddingId } })
    await db.couple.deleteMany({ where: { id: fixture.coupleId } })
  }
})

afterAll(async () => {
  await db.$disconnect()
})

describe('native deferred invitation handoff', () => {
  test('stores only hashes and redeems a valid one-time Play handoff', async () => {
    const fixture = await createFixture()
    const created = await makeHandoff(fixture)

    expect(created.secret).toHaveLength(43)
    expect(created.playStoreUrl).not.toContain(fixture.rsvpToken)
    expect(created.playStoreUrl).not.toContain(fixture.weddingSlug)
    expect(created.playStoreUrl).not.toContain('guest=')
    expect(created.playStoreUrl).not.toContain('email=')

    const rows = await db.$queryRaw<
      Array<{ tokenHash: string; rsvpTokenHash: string }>
    >`
      SELECT "tokenHash", "rsvpTokenHash"
      FROM private."InvitationInstallHandoff"
      WHERE "id" = ${created.id}
    `
    expect(rows).toHaveLength(1)
    expect(rows[0].tokenHash).not.toBe(created.secret)
    expect(rows[0].rsvpTokenHash).not.toBe(fixture.rsvpToken)

    const columns = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'private'
        AND table_name = 'InvitationInstallHandoff'
    `
    const columnNames = columns.map((column) => column.column_name)
    expect(columnNames).not.toContain('rsvpToken')
    expect(columnNames).not.toContain('guestName')
    expect(columnNames).not.toContain('guestEmail')
    expect(columnNames).not.toContain('weddingSlug')

    const first = await consumeInvitationInstallHandoff({
      secret: created.secret,
      ipAddress: '192.0.2.11',
      userAgent: 'Wewed integration test',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error(`Unexpected failure: ${first.reason}`)
    expect(first.weddingId).toBe(fixture.weddingId)
    expect(first.weddingSlug).toBe(fixture.weddingSlug)
    expect(first.guestId).toBe(fixture.guestId)
    expect(first.rsvpToken).toBe(fixture.rsvpToken)

    const replay = await consumeInvitationInstallHandoff({
      secret: created.secret,
      ipAddress: '192.0.2.12',
    })
    expect(replay).toEqual({ ok: false, reason: 'used' })
  })

  test('rejects an expired handoff', async () => {
    const fixture = await createFixture()
    const created = await makeHandoff(fixture)

    await db.$executeRaw`
      UPDATE private."InvitationInstallHandoff"
      SET "expiresAt" = NOW() - INTERVAL '1 minute'
      WHERE "id" = ${created.id}
    `

    const result = await consumeInvitationInstallHandoff({
      secret: created.secret,
      ipAddress: '192.0.2.20',
    })
    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  test('revokes a handoff when the underlying RSVP credential rotates', async () => {
    const fixture = await createFixture()
    const created = await makeHandoff(fixture)

    await db.rSVP.update({
      where: { id: fixture.rsvpId },
      data: { token: `rotated-${randomUUID()}` },
    })

    const result = await consumeInvitationInstallHandoff({
      secret: created.secret,
      ipAddress: '192.0.2.30',
    })
    expect(result).toEqual({ ok: false, reason: 'revoked' })

    const rows = await db.$queryRaw<Array<{ revokedAt: Date | null }>>`
      SELECT "revokedAt"
      FROM private."InvitationInstallHandoff"
      WHERE "id" = ${created.id}
    `
    expect(rows[0]?.revokedAt).toBeInstanceOf(Date)
  })

  test('allows exactly one winner when two devices redeem simultaneously', async () => {
    const fixture = await createFixture()
    const created = await makeHandoff(fixture)

    const [first, second] = await Promise.all([
      consumeInvitationInstallHandoff({
        secret: created.secret,
        ipAddress: '192.0.2.40',
      }),
      consumeInvitationInstallHandoff({
        secret: created.secret,
        ipAddress: '192.0.2.41',
      }),
    ])

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1)
    const failure = first.ok ? second : first
    expect(failure).toEqual({ ok: false, reason: 'used' })
  })
})
