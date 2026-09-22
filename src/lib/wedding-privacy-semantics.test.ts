import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
mock.module('server-only', () => ({}))
const originalSessionSecret = process.env.WEWED_SESSION_SECRET

/**
 * What each Wedding.privacy value actually authorizes.
 *
 * Written because an earlier review summary described `private` as "couple only", and that is
 * wrong in a way that matters before a live UAT: `resolveWeddingAccessFromTokens` resolves
 * membership *first* and returns on it, so any user holding an **active WeddingMembership** —
 * a planner, a second partner, any member, not just the couple owner — is admitted to a private
 * wedding. What `private` actually closes is the *invitation* surface: personal guest sessions and
 * shared/physical invitations are refused there, and only there.
 *
 * These tests pin all three values against every credential shape, so the distinction cannot
 * quietly drift again.
 */

const WEDDING_ID = 'wedding-a'
const GUEST_ID = 'guest-a'
const RSVP_TOKEN = 'invitation-token-a'
const DESTINATION_ID = 'destination-a'
const USER_ID = 'user-member'
const COUPLE_ID = 'couple-a'

let privacy: 'public' | 'link_only' | 'private' = 'public'
let membership: { role: string } | null = null

const fakeDb = {
  wedding: {
    findUnique: async () => ({
      id: WEDDING_ID, slug: 'wedding-a', title: 'Synthetic Wedding', monogram: null, tagline: null,
      date: new Date('2027-06-12T14:00:00Z'), venue: 'Synthetic Venue', venueMapUrl: null,
      venueCity: 'Harare', venueCountry: 'Zimbabwe', primaryColor: '#000', accentColor: '#111',
      backgroundColor: '#222', invitationCardStyle: 'ivory-floral-gold', invitationCardMessage: null,
      rsvpDeadline: null, privacy, coupleId: COUPLE_ID,
      couple: { partner1: 'A', partner2: 'B' },
    }),
  },
  weddingMembership: { findFirst: async () => membership },
  rSVP: {
    findUnique: async () => ({
      token: RSVP_TOKEN, attending: true, mealChoice: null, plusOne: false, plusOneName: null,
      plusOneMeal: null, kidsAttending: false, kidsCount: 0, dietaryNotes: null, message: null,
      checkedIn: false, checkedInAt: null,
      guest: {
        id: GUEST_ID, weddingId: WEDDING_ID, name: 'Synthetic Guest', email: null,
        tableNumber: null, seatingTable: null,
        // resolvePersonalInvitation includes the wedding through the guest; the access resolver
        // does not. One fixture serves both include shapes.
        wedding: {
          id: WEDDING_ID, slug: 'wedding-a', title: 'Synthetic Wedding',
          date: new Date('2027-06-12T14:00:00Z'),
          get privacy() { return privacy },
          invitationCardStyle: 'ivory-floral-gold',
        },
      },
    }),
  },
  qRDestination: { findFirst: async () => ({ id: DESTINATION_ID }) },
} as any

const { createWeddingGuestSessionToken } = await import('./wedding-guest-session')
const { createWeddingSharedInvitationSessionToken } = await import('./wedding-shared-invitation-session')
const { createAppSessionToken } = await import('./app-session')
const { resolveWeddingAccessFromTokens } = await import('./wedding-public-access')

const guestToken = () => createWeddingGuestSessionToken({
  weddingId: WEDDING_ID, guestId: GUEST_ID, rsvpToken: RSVP_TOKEN,
})
const sharedToken = () => createWeddingSharedInvitationSessionToken({
  weddingId: WEDDING_ID, destinationId: DESTINATION_ID,
})
const memberToken = () => createAppSessionToken({
  userId: USER_ID, authUserId: 'auth-member', email: 'member@example.test',
  role: 'planner', coupleId: null, activeWeddingId: WEDDING_ID,
})

const resolve = (tokens: Parameters<typeof resolveWeddingAccessFromTokens>[0]) =>
  resolveWeddingAccessFromTokens({ slug: 'wedding-a', ...tokens }, fakeDb)

beforeEach(() => {
  membership = null
  process.env.WEWED_SESSION_SECRET = 'synthetic-privacy-test-secret'
})
afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.WEWED_SESSION_SECRET
  else process.env.WEWED_SESSION_SECRET = originalSessionSecret
})

describe('wedding privacy semantics', () => {
  test('private admits an active wedding member — it is not couple-only', async () => {
    privacy = 'private'
    membership = { role: 'planner' }
    const result = await resolve({ appSessionToken: memberToken() })
    expect(result.allowed).toBe(true)
    expect(result.accessKind).toBe('wedding_member')
  })

  test('private denies an invited guest holding a valid personal session', async () => {
    privacy = 'private'
    const result = await resolve({ guestSessionToken: guestToken() })
    expect(result.allowed).toBe(false)
    expect(result.status).toBe(403)
    expect(result.reason).toBe('private')
  })

  test('private denies a valid shared/physical invitation', async () => {
    privacy = 'private'
    const result = await resolve({ sharedInvitationSessionToken: sharedToken() })
    expect(result.allowed).toBe(false)
    expect(result.status).toBe(403)
  })

  test('private denies an anonymous visitor', async () => {
    privacy = 'private'
    expect((await resolve({})).allowed).toBe(false)
  })

  test('private denies a membership that is not active', async () => {
    // The membership lookup itself filters status:'active'; a non-active member resolves to null
    // and then falls through to the same refusal an outsider gets.
    privacy = 'private'
    membership = null
    const result = await resolve({ appSessionToken: memberToken() })
    expect(result.allowed).toBe(false)
    expect(result.status).toBe(403)
  })

  test('link_only admits an invited guest', async () => {
    privacy = 'link_only'
    const result = await resolve({ guestSessionToken: guestToken() })
    expect(result.allowed).toBe(true)
    expect(result.accessKind).toBe('invited_guest')
    expect(result.guest?.id).toBe(GUEST_ID)
  })

  test('link_only admits a shared/physical invitation, but never as a guest identity', async () => {
    privacy = 'link_only'
    const result = await resolve({ sharedInvitationSessionToken: sharedToken() })
    expect(result.allowed).toBe(true)
    // Anonymous read-only access. A bulk-printed card must not impersonate an RSVP identity.
    expect(result.accessKind).toBe('public')
    expect(result.guest).toBeNull()
  })

  test('link_only denies an anonymous visitor', async () => {
    privacy = 'link_only'
    const result = await resolve({})
    expect(result.allowed).toBe(false)
    expect(result.status).toBe(401)
    expect(result.reason).toBe('access_required')
  })

  test('link_only admits an active wedding member', async () => {
    privacy = 'link_only'
    membership = { role: 'planner' }
    expect((await resolve({ appSessionToken: memberToken() })).allowed).toBe(true)
  })

  test('public admits an anonymous visitor', async () => {
    privacy = 'public'
    const result = await resolve({})
    expect(result.allowed).toBe(true)
    expect(result.accessKind).toBe('public')
    expect(result.guest).toBeNull()
  })

  test('public recognizes an invited guest as invited_guest', async () => {
    privacy = 'public'
    const result = await resolve({ guestSessionToken: guestToken() })
    expect(result.allowed).toBe(true)
    expect(result.accessKind).toBe('invited_guest')
  })

  test('an unrecognized privacy value fails closed to private', async () => {
    privacy = 'nonsense' as never
    expect((await resolve({})).allowed).toBe(false)
    expect((await resolve({ guestSessionToken: guestToken() })).status).toBe(403)
  })
})

/**
 * The invitation exchange surfaces are separate code paths from the access resolver above, and
 * each carries its own `privacy === 'private'` refusal. They are pinned here so the three cannot
 * drift apart: a wedding that refuses a guest through one path must refuse it through all of them.
 */
describe('private refuses every personal-invitation exchange path', () => {
  test('resolvePersonalInvitation returns null for a private wedding', async () => {
    const { resolvePersonalInvitation } = await import('./personal-invitation-access')
    privacy = 'private'
    expect(await resolvePersonalInvitation({ weddingSlug: 'wedding-a', token: RSVP_TOKEN }, fakeDb)).toBeNull()
  })

  test('resolvePersonalInvitation resolves for link_only and public', async () => {
    const { resolvePersonalInvitation } = await import('./personal-invitation-access')
    for (const value of ['link_only', 'public'] as const) {
      privacy = value
      const resolved = await resolvePersonalInvitation({ weddingSlug: 'wedding-a', token: RSVP_TOKEN }, fakeDb)
      expect(resolved?.guestId).toBe(GUEST_ID)
    }
  })

  test('both guest-session exchange routes still carry the private refusal', async () => {
    // Source-level, matching the existing unified-navigation-privacy contract style: these routes
    // are Next handlers whose refusal is a single condition, and the condition is what must not
    // disappear. Both also normalize timing so a private wedding is indistinguishable from a bad
    // token to an attacker probing for valid invitations.
    const post = await Bun.file('src/app/api/weddings/[slug]/guest-session/route.ts').text()
    const exchange = await Bun.file('src/app/api/weddings/[slug]/guest-session/exchange/route.ts').text()
    for (const source of [post, exchange]) {
      expect(source).toContain("rsvp.guest.wedding.privacy === 'private'")
      expect(source).toContain('setTimeout(resolve, 120)')
    }
  })
})
