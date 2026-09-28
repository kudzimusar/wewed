import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { primarySessionSigningSecret } from '@/lib/session-signing-secret'

/**
 * Native → browser Guest handoff (QRO06-GUEST-LAUNCH01).
 *
 * The native Guest session lives in Keychain / secure storage and is sent by the native client as
 * a Cookie header; it is never in Safari/Chrome. For a `link_only` wedding an anonymous browser is
 * correctly refused, so a Couple Website / Gifts CTA that simply opened `/w/{slug}` lost the
 * Guest's authority the moment it left the app.
 *
 * This is the opposite direction of the invitation install handoff (web → app):
 *
 *  1. The native app, holding an ALREADY VALID Guest session, asks
 *     `POST /api/weddings/{slug}/guest-browser-handoff` for one allowlisted destination KEY.
 *     The Guest is identified from that server-verified session only — never from a UI value.
 *  2. The server returns a short-lived signed exchange, carried in the URL fragment of a Wewed
 *     entry page (never sent to a server, so never in request logs). It carries no RSVP token and no
 *     session cookie: only the wedding + Guest identifiers, the HMAC invitation-version
 *     fingerprint (itself keyed; it does not reveal the token), the destination key, an expiry and
 *     a nonce, signed with a domain-separated key.
 *  3. The browser opens `/guest-handoff/{slug}#h=…`, which POSTs the exchange to
 *     `…/guest-browser-handoff/redeem`. Redemption re-reads the wedding,
 *     the Guest and the CURRENT invitation: a rotated token, a Guest moved to another wedding, a
 *     wedding made `private`, an expired or tampered exchange all fail closed to the access
 *     gateway. Success issues Wewed's normal browser Guest session and redirects to a path the
 *     SERVER derives from the destination key — never to a caller-supplied URL.
 *
 * Stateless by design: no table, no migration, no business-data write. The exchange is valid for
 * {@link GUEST_BROWSER_HANDOFF_TTL_SECONDS}; within that window it grants exactly what the Guest's
 * own personal invitation link already grants, so it widens nothing.
 */

export const GUEST_BROWSER_HANDOFF_TTL_SECONDS = 90

export const GUEST_BROWSER_HANDOFF_DESTINATIONS = ['site', 'registry'] as const
export type GuestBrowserHandoffDestination = (typeof GUEST_BROWSER_HANDOFF_DESTINATIONS)[number]

export function isGuestBrowserHandoffDestination(value: unknown): value is GuestBrowserHandoffDestination {
  return typeof value === 'string' && (GUEST_BROWSER_HANDOFF_DESTINATIONS as readonly string[]).includes(value)
}

/**
 * The only places a redeemed handoff may land. Server-derived; never taken from a request.
 * `view=site` tells the wedding page this entry is an explicit request for the Couple Website, so
 * it skips the invitation cover once (the page strips the marker immediately).
 */
export function guestBrowserHandoffDestinationPath(slug: string, destination: GuestBrowserHandoffDestination): string {
  const base = `/w/${encodeURIComponent(slug)}?view=site`
  return destination === 'registry' ? `${base}#registry` : base
}

/**
 * The browser entry the native app opens. The signed exchange travels in the URL FRAGMENT, which
 * browsers never send to a server — so it cannot reach request logs, proxies or a Referer. The page
 * removes it from history and POSTs it to the redeem endpoint.
 */
export function guestBrowserHandoffEntryPath(slug: string, token: string): string {
  return `/guest-handoff/${encodeURIComponent(slug)}#${new URLSearchParams({ h: token })}`
}

export interface GuestBrowserHandoffClaims {
  weddingId: string
  guestId: string
  /** `invitationVersionFingerprint` of the invitation current when the handoff was issued. */
  invitationVersion: string
  destination: GuestBrowserHandoffDestination
  expiresAt: number
}

interface WirePayload {
  v: 1
  w: string
  g: string
  f: string
  d: GuestBrowserHandoffDestination
  e: number
  n: string
}

function signingKey(): Buffer {
  // Domain-separated from every session/cookie signer that shares the primary secret.
  return createHmac('sha256', primarySessionSigningSecret()).update('wewed.guest.browser-handoff.v1').digest()
}

function sign(encoded: string): string {
  return createHmac('sha256', signingKey()).update(encoded, 'utf8').digest('base64url')
}

export function createGuestBrowserHandoffToken(
  input: Omit<GuestBrowserHandoffClaims, 'expiresAt'>,
  now = Date.now(),
): { token: string; expiresAt: number } {
  const expiresAt = now + GUEST_BROWSER_HANDOFF_TTL_SECONDS * 1000
  const payload: WirePayload = {
    v: 1,
    w: input.weddingId,
    g: input.guestId,
    f: input.invitationVersion,
    d: input.destination,
    e: expiresAt,
    n: randomBytes(12).toString('base64url'),
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return { token: `${encoded}.${sign(encoded)}`, expiresAt }
}

export type GuestBrowserHandoffVerification =
  | { ok: true; claims: GuestBrowserHandoffClaims }
  | { ok: false; reason: 'malformed' | 'signature' | 'expired' }

export function verifyGuestBrowserHandoffToken(token: string, now = Date.now()): GuestBrowserHandoffVerification {
  if (typeof token !== 'string' || token.length > 2048) return { ok: false, reason: 'malformed' }
  const [encoded, signature, extra] = token.split('.')
  if (!encoded || !signature || extra !== undefined) return { ok: false, reason: 'malformed' }

  const expected = Buffer.from(sign(encoded), 'base64url')
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, reason: 'signature' }
  }

  let payload: WirePayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as WirePayload
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (
    payload?.v !== 1 ||
    typeof payload.w !== 'string' || !payload.w ||
    typeof payload.g !== 'string' || !payload.g ||
    typeof payload.f !== 'string' || !payload.f ||
    !isGuestBrowserHandoffDestination(payload.d) ||
    typeof payload.e !== 'number'
  ) {
    return { ok: false, reason: 'malformed' }
  }
  // Never accept an exchange claiming a lifetime longer than this server would issue.
  if (payload.e <= now || payload.e > now + GUEST_BROWSER_HANDOFF_TTL_SECONDS * 1000 + 5_000) {
    return { ok: false, reason: 'expired' }
  }
  return {
    ok: true,
    claims: {
      weddingId: payload.w,
      guestId: payload.g,
      invitationVersion: payload.f,
      destination: payload.d,
      expiresAt: payload.e,
    },
  }
}
