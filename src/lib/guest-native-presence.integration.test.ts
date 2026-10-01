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
let recordGuestNativePresence: typeof import('@/lib/guest-native-presence')['recordGuestNativePresence']
let loadPlannerInvitationProjection: typeof import('@/lib/planner-invitation-projection')['loadPlannerInvitationProjection']

const suffix = randomUUID().slice(0, 8)
let coupleId = ''
let weddingId = ''
let guestId = ''

describe.skipIf(!isLocal)('Guest native activation against disposable PostgreSQL', () => {
  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ recordGuestNativePresence } = await import('@/lib/guest-native-presence'))
    ;({ loadPlannerInvitationProjection } = await import('@/lib/planner-invitation-projection'))

    const couple = await db.couple.create({
      data: { slug: `native-presence-${suffix}`, partner1: 'Native', partner2: 'Presence' },
    })
    coupleId = couple.id

    const wedding = await db.wedding.create({
      data: {
        slug: `native-presence-wedding-${suffix}`,
        title: 'Native Presence UAT',
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        venue: 'Disposable Venue',
        venueCity: 'Harare',
        venueCountry: 'Zimbabwe',
        coupleId,
      },
    })
    weddingId = wedding.id

    const guest = await db.guest.create({
      data: { weddingId, name: 'Native Presence Guest' },
    })
    guestId = guest.id
    await db.rSVP.create({
      data: { guestId, token: `native-presence-${suffix}`, attending: true },
    })
  })

  afterAll(async () => {
    if (!db || !weddingId) return
    await db.guestNativePresence.deleteMany({ where: { weddingId } })
    await db.rSVP.deleteMany({ where: { guest: { weddingId } } })
    await db.guest.deleteMany({ where: { weddingId } })
    await db.wedding.delete({ where: { id: weddingId } })
    await db.couple.delete({ where: { id: coupleId } })
  })

  test('browser-only activity never creates native presence', async () => {
    const result = await recordGuestNativePresence({
      weddingId,
      guestId,
      headers: new Headers({
        'x-wewed-client': 'web',
        'x-wewed-native-platform': 'android',
      }),
    })
    expect(result).toBeNull()
    expect(await db.guestNativePresence.count({ where: { weddingId, guestId } })).toBe(0)
  })

  test('Android and iOS persist independently while Any App Active counts the Guest once', async () => {
    await recordGuestNativePresence({
      weddingId,
      guestId,
      headers: new Headers({
        'x-wewed-client': 'native',
        'x-wewed-native-platform': 'android',
        'x-wewed-app-version': '2.0.0',
        'x-wewed-build-version': '200',
      }),
      invitationOpened: true,
    })
    await recordGuestNativePresence({
      weddingId,
      guestId,
      headers: new Headers({
        'x-wewed-client': 'native',
        'x-wewed-native-platform': 'ios',
        'x-wewed-app-version': '2.0.0',
        'x-wewed-build-version': '201',
      }),
    })

    const rows = await db.guestNativePresence.findMany({
      where: { weddingId, guestId },
      orderBy: { platform: 'asc' },
    })
    expect(rows.map((row) => row.platform)).toEqual(['android', 'ios'])
    expect(rows.find((row) => row.platform === 'android')?.lastInvitationOpenAt).not.toBeNull()

    const projection = await loadPlannerInvitationProjection(weddingId, 'http://localhost:3000')
    expect(projection).not.toBeNull()
    expect(projection?.summary.nativeActivated).toBe(1)
    expect(projection?.summary.nativeAndroid).toBe(1)
    expect(projection?.summary.nativeIos).toBe(1)
    expect(projection?.data[0]?.nativeActivated).toBe(true)
    expect(new Set(projection?.data[0]?.nativePlatforms)).toEqual(new Set(['android', 'ios']))
  })

  test('repeat native activity upserts rather than inventing a second activation identity', async () => {
    const later = new Date(Date.now() + 60_000)
    await recordGuestNativePresence({
      weddingId,
      guestId,
      headers: new Headers({
        'x-wewed-client': 'native',
        'x-wewed-native-platform': 'android',
        'x-wewed-app-version': '2.0.1',
        'x-wewed-build-version': '202',
      }),
      now: later,
    })

    const androidRows = await db.guestNativePresence.findMany({
      where: { weddingId, guestId, platform: 'android' },
    })
    expect(androidRows).toHaveLength(1)
    expect(androidRows[0].appVersion).toBe('2.0.1')
    expect(androidRows[0].lastSeenAt.getTime()).toBe(later.getTime())
  })
})
