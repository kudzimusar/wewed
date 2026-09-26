#!/usr/bin/env bun
/**
 * wewed.parity.v1 live parity tooling (QRO 01 §13–§16, §33).
 *
 *   bun scripts/parity/wewed-parity.ts preflight                      (no credentials; read-only)
 *   bun scripts/parity/wewed-parity.ts collect --out run.json --network-log network.json
 *   bun scripts/parity/wewed-parity.ts check run.json [ios-G.json android-G.json ...]
 *       [--require desktop,native-api,ios,android] [--same-wedding G,G-VIA-P,P]
 *
 * `collect` exercises the real transports read-only against ONE qualification origin (the
 * integration Preview or loopback — https://wewed.pro is refused) and writes wewed.parity.v1
 * records. Every credential comes from the environment and is never printed or written:
 *
 *   WEWED_PARITY_ORIGIN               required  allowlisted https Preview origin, or loopback
 *   WEWED_PARITY_COMMIT_SHA           required  commit the Preview deployment was built from
 *   WEWED_PARITY_PROTECTION_BYPASS    optional  Vercel protection-bypass secret for the Preview
 *   WEWED_PARITY_GUEST_INVITATION     optional  the controlled Guest's private invitation URL → label G
 *   WEWED_PARITY_ACCOUNT_EMAIL        optional  Couple/Planner/Coordinator account → label P, G-VIA-P
 *   WEWED_PARITY_ACCOUNT_PASSWORD     optional
 *   WEWED_PARITY_ACCOUNT_LABEL        optional  default P (CA for the Couple, C for a Coordinator)
 *   WEWED_PARITY_WEDDING_ID           optional  wedding to select (defaults to the Guest's wedding)
 *   WEWED_PARITY_ALLOW_PASS_GET=1     optional  also read the Guest Wedding Pass. Inside the T-14
 *                                               window this can ISSUE a credential (a write), so it
 *                                               is off unless explicitly requested. Outside the
 *                                               window it only reports not_yet_issuable.
 *
 * Writes performed by `collect`: none to wedding data. It creates authentication sessions (Supabase
 * sign-in, the signed Guest cookie). On a Preview, desktop sign-in account bookkeeping and
 * invitation acceptance are suppressed server-side (P13-LIVE-1).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import {
  checkWewedParityRun,
  emptyParityRecord,
  parityTextDigest,
  passTokenDigest,
  PARITY_CLIENTS,
  WEWED_PARITY_CONTRACT,
  type ParityClient,
  type ParityPassState,
  type WewedParityRecordV1,
  type WewedParityRunV1,
} from '../../src/lib/parity/wewed-parity-v1'
import { validateQualificationOrigin } from '../../src/lib/parity/qualification-origin'
import { classifyParityResponse as classify, redactPath } from '../../src/lib/parity/network-evidence'
import { guestRsvpStatus } from '../../src/lib/guest-record-authority'
import { membershipRoleForWorkspaceKind, workspaceKindForMembershipRole } from '../../src/lib/wedding-relationship-eligibility'

type Json = Record<string, any>

function fail(message: string): never {
  console.error(`wewed-parity: ${message}`)
  process.exit(2)
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const weddingDateOf = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : null)

/**
 * QRO 02 §29 network evidence: one entry per request — timestamp, client, method, path with every
 * query value redacted, HTTP status and a safe classification. Never headers, cookies, bodies,
 * tokens or credential-bearing URLs.
 */
export interface NetworkEvidence {
  at: string
  client: string
  method: string
  path: string
  status: number
  classification: string
}
const NETWORK_LOG: NetworkEvidence[] = []

class Transport {
  private cookies = new Map<string, string>()
  constructor(private origin: string, private bypass: string | undefined, private client: string) {}

  async request(method: string, path: string, init: { body?: unknown; bearer?: string } = {}) {
    const headers: Record<string, string> = { Accept: 'application/json', 'x-wewed-client': 'parity-collector' }
    if (this.bypass) headers['x-vercel-protection-bypass'] = this.bypass
    if (init.bearer) headers.Authorization = `Bearer ${init.bearer}`
    if (init.body !== undefined) headers['Content-Type'] = 'application/json'
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const response = await fetch(`${this.origin}${path}`, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: 'manual',
    })
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
    const text = await response.text()
    let body: Json = {}
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      body = {}
    }
    NETWORK_LOG.push({
      at: new Date().toISOString(),
      client: this.client,
      method,
      path: redactPath(path),
      status: response.status,
      classification: classify(response.status, body, response.headers.get('location')),
    })
    // Status and path only: never the body, which may hold tokens.
    if (response.status >= 300 && ![409, 410, 423, 503].includes(response.status)) {
      console.error(`wewed-parity: ${method} ${path} → ${response.status}${body.code ? ` ${body.code}` : ''}`)
    }
    return { status: response.status, body }
  }
}

async function collectGuest(origin: string, commitSha: string, bypass: string | undefined, invitation: string) {
  let slug: string
  let token: string
  try {
    const url = new URL(invitation)
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments[0] !== 'invite' || !segments[1]) throw new Error('shape')
    slug = decodeURIComponent(segments[1])
    token = url.searchParams.get('rsvp') ?? ''
    if (!token) throw new Error('token')
  } catch {
    fail('WEWED_PARITY_GUEST_INVITATION must be a private invitation URL (/invite/<slug>?rsvp=…)')
  }
  const t = new Transport(origin, bypass, 'desktop:guest')
  const exchange = await t.request('POST', `/api/weddings/${encodeURIComponent(slug)}/guest-session`, { body: { token } })
  if (exchange.status !== 200) fail(`Guest invitation exchange failed (${exchange.status})`)
  const session = await t.request('GET', `/api/weddings/${encodeURIComponent(slug)}/guest-session`)
  if (session.status !== 200 || !session.body.authorized) fail(`Guest session read failed (${session.status})`)
  const { wedding, guest, rsvp } = session.body

  let passAvailability: ParityPassState | null = null
  let passSerial: string | null = null
  let passDigest: string | null = null
  if (process.env.WEWED_PARITY_ALLOW_PASS_GET === '1') {
    const pass = await t.request('GET', '/api/wedding-day/pass')
    if (pass.status === 200 && pass.body.data?.token) {
      passAvailability = 'active'
      passSerial = pass.body.data.passSerial ?? null
      passDigest = passTokenDigest(String(pass.body.data.token))
      delete pass.body.data.token
    } else if (pass.body.availability?.state) {
      passAvailability = pass.body.availability.state
    }
  }

  return {
    ...emptyParityRecord({ label: 'G', role: 'guest', client: 'desktop', baseUrl: origin, commitSha }),
    weddingId: wedding.id ?? null,
    weddingDate: weddingDateOf(wedding.date),
    weddingTitleDigest: parityTextDigest(wedding.title),
    venueDigest: parityTextDigest(wedding.venue),
    guestId: guest.id ?? null,
    guestNameDigest: parityTextDigest(guest.name),
    rsvpStatus: guestRsvpStatus(rsvp.attending),
    partySize: typeof rsvp.partySize === 'number' ? rsvp.partySize : null,
    tableId: guest.seatingTableId ?? null,
    mealChoice: rsvp.mealChoice ?? null,
    invitationStyle: wedding.invitationCardStyle ?? null,
    invitationMessageDigest: parityTextDigest(wedding.invitationCardMessage),
    passAvailability,
    passSerial,
    passDigest,
  } satisfies WewedParityRecordV1
}

async function collectAccount(
  origin: string,
  commitSha: string,
  bypass: string | undefined,
  credentials: { email: string; password: string; label: string },
  targetWeddingId: string | null,
  guestId: string | null,
): Promise<WewedParityRecordV1[]> {
  const records: WewedParityRecordV1[] = []
  const guestLabel = `G-VIA-${credentials.label}`

  // Desktop/PWA transport.
  const desktop = new Transport(origin, bypass, 'desktop:account')
  const signin = await desktop.request('POST', '/api/auth/signin', { body: { email: credentials.email, password: credentials.password } })
  if (signin.status !== 200) fail(`desktop sign-in failed (${signin.status})`)
  if (targetWeddingId && signin.body.activeWedding?.id !== targetWeddingId) {
    // Selects an existing server-issued membership; never a client-chosen role.
    const switched = await desktop.request('POST', '/api/auth/wedding', { body: { weddingId: targetWeddingId } })
    if (switched.status !== 200) fail(`desktop wedding switch to the target wedding failed (${switched.status})`)
  }
  const me = await desktop.request('GET', '/api/auth/me')
  const wedding = me.body.activeWedding
  if (me.status !== 200 || !wedding) fail(`desktop /api/auth/me failed (${me.status})`)
  const desktopKind = workspaceKindForMembershipRole(wedding.membershipRole)
  records.push({
    ...emptyParityRecord({ label: credentials.label, role: desktopKind ?? 'planner', client: 'desktop', baseUrl: origin, commitSha }),
    accessUserId: me.body.user?.accessUserId ?? null,
    // Desktop has no grant object; its equivalent is the membership-derived grant (shared rule).
    grantId: desktopKind ? `${desktopKind}:wedding:${wedding.id}` : null,
    membershipRole: wedding.membershipRole ?? null,
    permissions: wedding.permissions ?? null,
    weddingId: wedding.id,
    coupleId: wedding.coupleId ?? null,
    weddingDate: weddingDateOf(wedding.date),
    weddingTitleDigest: parityTextDigest(wedding.title),
    venueDigest: parityTextDigest(wedding.venue),
  })
  if (guestId) {
    const list = await desktop.request('GET', '/api/planner/guests')
    const row = (list.body.data ?? []).find((g: Json) => g.id === guestId)
    records.push({
      ...emptyParityRecord({ label: guestLabel, role: 'guest_record', client: 'desktop', baseUrl: origin, commitSha }),
      weddingId: row?.weddingId ?? null,
      guestId: row?.id ?? null,
      guestNameDigest: parityTextDigest(row?.name),
      rsvpStatus: row?.rsvpStatus ?? null,
      partySize: row?.partySize ?? null,
      tableId: row?.seatingTableId ?? null,
    })
  }

  // Native transport — the exact endpoints the iOS/Android apps call.
  const native = new Transport(origin, bypass, 'native-api:account')
  const nativeSignin = await native.request('POST', '/api/native/account/signin', { body: { email: credentials.email, password: credentials.password } })
  const bearer: string | undefined = nativeSignin.body.sessionToken
  if (nativeSignin.status !== 200 || !bearer) fail(`native sign-in failed (${nativeSignin.status})`)
  const authority = await native.request('GET', '/api/native/account/authority', { bearer })
  const weddingIdForGrant = targetWeddingId ?? wedding.id
  const grant = (authority.body.authority?.workspaceGrants ?? []).find(
    (g: Json) => g.scopeKind === 'wedding' && g.weddingId === weddingIdForGrant && membershipRoleForWorkspaceKind(g.workspaceKind),
  )
  let nativeWedding: Json | null = null
  if (grant) {
    const workspace = await native.request('GET', `/api/native/account/workspace?grantId=${encodeURIComponent(grant.grantId)}`, { bearer })
    nativeWedding = workspace.body.workspace?.wedding ?? null
  }
  records.push({
    ...emptyParityRecord({
      label: credentials.label,
      role: grant?.workspaceKind ?? desktopKind ?? 'planner',
      client: 'native-api',
      baseUrl: origin,
      commitSha,
    }),
    accessUserId: authority.body.authority?.accessUserId ?? null,
    grantId: grant?.grantId ?? null,
    membershipRole: grant ? membershipRoleForWorkspaceKind(grant.workspaceKind) : null,
    permissions: grant?.permissions ?? null,
    weddingId: grant?.weddingId ?? null,
    coupleId: grant?.coupleId ?? null,
    weddingDate: weddingDateOf(nativeWedding?.date),
    weddingTitleDigest: parityTextDigest(nativeWedding?.title),
    venueDigest: parityTextDigest(nativeWedding?.venue),
  })
  if (guestId && grant) {
    const list = await native.request('GET', `/api/native/wedding/guests?grantId=${encodeURIComponent(grant.grantId)}`, { bearer })
    const row = (list.body.data ?? []).find((g: Json) => g.id === guestId)
    records.push({
      ...emptyParityRecord({ label: guestLabel, role: 'guest_record', client: 'native-api', baseUrl: origin, commitSha }),
      weddingId: row ? grant.weddingId : null,
      guestId: row?.id ?? null,
      guestNameDigest: parityTextDigest(row?.name),
      rsvpStatus: row?.rsvpStatus ?? null,
      partySize: row?.partySize ?? null,
      tableId: row?.seatingTableId ?? null,
    })
  }
  return records
}

async function collect() {
  const origin = validateQualificationOrigin(process.env.WEWED_PARITY_ORIGIN)
  if (!origin.ok) fail(`WEWED_PARITY_ORIGIN rejected (${origin.reason}); use the integration Preview or loopback`)
  const commitSha = process.env.WEWED_PARITY_COMMIT_SHA?.trim() ?? ''
  if (!/^[0-9a-f]{7,40}$/.test(commitSha)) fail('WEWED_PARITY_COMMIT_SHA must be the deployed git SHA')
  const bypass = process.env.WEWED_PARITY_PROTECTION_BYPASS?.trim() || undefined
  const records: WewedParityRecordV1[] = []

  let guestWeddingId: string | null = null
  let guestId: string | null = null
  if (process.env.WEWED_PARITY_GUEST_INVITATION) {
    const guest = await collectGuest(origin.origin, commitSha, bypass, process.env.WEWED_PARITY_GUEST_INVITATION)
    records.push(guest)
    guestWeddingId = guest.weddingId
    guestId = guest.guestId
  }
  const email = process.env.WEWED_PARITY_ACCOUNT_EMAIL
  const password = process.env.WEWED_PARITY_ACCOUNT_PASSWORD
  if (email && password) {
    const label = (process.env.WEWED_PARITY_ACCOUNT_LABEL ?? 'P').trim()
    records.push(...await collectAccount(origin.origin, commitSha, bypass, { email, password, label },
      process.env.WEWED_PARITY_WEDDING_ID?.trim() || guestWeddingId, guestId))
  }
  if (!records.length) fail('nothing to collect: set WEWED_PARITY_GUEST_INVITATION and/or the account credentials')

  const run: WewedParityRunV1 = {
    contract: WEWED_PARITY_CONTRACT,
    runId: `live-${new Date().toISOString()}`,
    requiredClients: ['desktop', 'native-api'],
    records,
  }
  const out = arg('--out')
  const json = `${JSON.stringify(run, null, 2)}\n`
  if (out) writeFileSync(out, json)
  else process.stdout.write(json)
  writeNetworkLog()
}

function writeNetworkLog() {
  const file = arg('--network-log')
  if (file) writeFileSync(file, `${JSON.stringify(NETWORK_LOG, null, 2)}\n`)
}

/**
 * Credential-free, read-only readiness probe of the qualification origin: Deployment Protection
 * (with the bypass if supplied), route liveness and the Wedding Day (WW2) feature state. It sends no
 * account, invitation or session material and cannot write anything.
 */
async function preflight() {
  const origin = validateQualificationOrigin(process.env.WEWED_PARITY_ORIGIN)
  if (!origin.ok) fail(`WEWED_PARITY_ORIGIN rejected (${origin.reason})`)
  const bypass = process.env.WEWED_PARITY_PROTECTION_BYPASS?.trim() || undefined
  const t = new Transport(origin.origin, bypass, 'preflight')
  const root = await t.request('GET', '/api/native/account/authority')
  const pass = await t.request('GET', '/api/wedding-day/pass')
  const signin = await t.request('POST', '/api/native/account/signin', { body: {} })
  const protectedByVercel = NETWORK_LOG.some((entry) => entry.classification === 'vercel-deployment-protection')
  // Only an answer from the application itself (JSON `success: false`) proves a route or state.
  const app = (response: { body: Json }) => response.body.success === false && !response.body.protection
  const report = {
    origin: origin.origin,
    bypassSupplied: Boolean(bypass),
    deploymentProtection: protectedByVercel ? (bypass ? 'BYPASS_REJECTED' : 'PROTECTED_NO_BYPASS') : 'PASSED',
    nativeAuthorityRoute: protectedByVercel ? 'UNPROVEN' : app(root) && root.status === 401 ? 'LIVE' : `UNEXPECTED_${root.status}`,
    nativeSigninRoute: protectedByVercel ? 'UNPROVEN' : app(signin) && [400, 401].includes(signin.status) ? 'LIVE' : `UNEXPECTED_${signin.status}`,
    weddingDay: protectedByVercel
      ? 'UNPROVEN'
      : pass.body.code === 'WEDDING_DAY_DISABLED' ? 'DISABLED'
        : pass.body.code === 'WEDDING_DAY_KEY_CONFIGURATION_INVALID' ? 'ENABLED_KEYS_INVALID'
          : app(pass) && pass.status === 401 ? 'ENABLED'
            : `UNPROVEN_${pass.status}`,
    network: NETWORK_LOG,
  }
  console.log(JSON.stringify(report, null, 2))
  writeNetworkLog()
}

function check() {
  const files = process.argv.slice(3).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'))
  if (!files.length) fail('check needs at least one run or record file')
  const records: unknown[] = []
  let base: Partial<WewedParityRunV1> = {}
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (Array.isArray(parsed?.records)) {
      base = { ...parsed, ...base }
      records.push(...parsed.records)
    } else {
      records.push(parsed)
    }
  }
  const required = arg('--require')?.split(',').map((c) => c.trim()) as ParityClient[] | undefined
  const sameWedding = arg('--same-wedding')?.split(',').map((l) => l.trim())
  const run = {
    contract: WEWED_PARITY_CONTRACT,
    runId: base.runId ?? 'merged',
    requiredClients: required ?? base.requiredClients ?? ['desktop', 'native-api'],
    sameWeddingLabels: sameWedding ?? base.sameWeddingLabels,
    records,
  }
  if (run.requiredClients.some((c) => !(PARITY_CLIENTS as readonly string[]).includes(c))) fail(`--require must name clients from ${PARITY_CLIENTS.join(', ')}`)
  const result = checkWewedParityRun(run)
  for (const [label, clients] of Object.entries(result.compared)) console.log(`compared ${label}: ${clients.join(', ')}`)
  for (const failure of result.failures) console.log(`FAIL ${failure.code}${failure.label ? ` [${failure.label}]` : ''}: ${failure.message}`)
  console.log(result.ok ? 'wewed.parity.v1 PASS' : `wewed.parity.v1 FAIL (${result.failures.length})`)
  process.exit(result.ok ? 0 : 1)
}

const command = process.argv[2]
if (command === 'preflight') await preflight()
else if (command === 'collect') await collect()
else if (command === 'check') check()
else fail('usage: wewed-parity.ts preflight | collect [--out file] [--network-log file] | check <files…> [--require clients] [--same-wedding labels]')
