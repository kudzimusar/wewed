import 'server-only'

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  randomUUID,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession } from '@/lib/app-session'
import { readWeddingGuestSession, guestSessionMatchesInvitation } from '@/lib/wedding-guest-session'

export const WW2_VERSION = 'WW2'
export const WW2_ALGORITHM = 'ECDSA_P256_SHA256'
export const WEDDING_DAY_EVENT_KEY = 'wedding-day'
export const WEDDING_DAY_EVENT_BIT = 0x04
export const DEFAULT_WW2_EVENT_MASK = 0x0e

export type WeddingDayActorRole =
  | 'guest'
  | 'usher'
  | 'planner'
  | 'vendor'
  | 'couple'
  | 'admin'

export type WeddingServicePresenceState =
  | 'CONFIRMED'
  | 'EN_ROUTE'
  | 'ARRIVED_ON_SITE'
  | 'SERVICE_ACTIVE'
  | 'COMPLETED'

export interface WeddingDayOperatorContext {
  userId: string
  email: string
  weddingId: string
  role: Exclude<WeddingDayActorRole, 'guest'>
}

interface PassKeyRow {
  id: string
  weddingId: string
  keyId: string
  publicKeyPem: string
  publicKeyDerBase64: string
  status: string
  activeFrom: Date
  expiresAt: Date | null
  revokedAt: Date | null
}

interface CredentialRow {
  id: string
  weddingId: string
  guestId: string
  passKeyId: string
  weddingShortId: string
  passSerial: string
  tokenVersion: string
  eventBitmask: number
  nonce: string
  signatureHex: string
  token: string
  issuedAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  revocationReason: string | null
}

interface GuestEligibilityRow {
  guestId: string
  guestName: string
  weddingId: string
  weddingSlug: string
  weddingTitle: string
  weddingDate: Date
  venue: string
  attending: boolean | null
  plusOne: boolean
  plusOneName: string | null
  kidsAttending: boolean
  kidsCount: number
  tableNumber: number | null
}

interface HouseholdMember {
  attendeeKey: string
  attendeeKind: 'primary' | 'plus_one' | 'child'
  attendeeName: string
}

interface ParsedWw2Token {
  version: 'WW2'
  weddingShortId: string
  passSerial: string
  eventBitmask: number
  nonce: string
  signatureHex: string
  canonicalPayload: string
}

interface KeyMaterial {
  privateKeyPem: string
  publicKeyPem: string
  publicKeyDerBase64: string
}

interface CheckInResultItem {
  attendeeKey: string
  attendeeName: string
  result: 'ADMITTED' | 'ALREADY_CHECKED_IN'
}

export interface WeddingCheckInResult {
  guestId: string
  eventKey: string
  results: CheckInResultItem[]
  checkedInPeople: number
  expectedPeople: number
  householdComplete: boolean
}

const PRESENCE_STATES: WeddingServicePresenceState[] = [
  'CONFIRMED',
  'EN_ROUTE',
  'ARRIVED_ON_SITE',
  'SERVICE_ACTIVE',
  'COMPLETED',
]

function normalizePem(value: string | undefined, envName: string): string {
  const normalized = value?.trim().replace(/\\n/g, '\n')
  if (!normalized) {
    throw new Error(`[wewed:wedding-day] Missing ${envName}.`)
  }
  return normalized
}

function keyMaterialFromPrivateKey(privateKeyPem: string): KeyMaterial {
  const privateKey = createPrivateKey(privateKeyPem)
  const publicKey = createPublicKey(privateKey)
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const publicKeyDerBase64 = Buffer.from(
    publicKey.export({ type: 'spki', format: 'der' }),
  ).toString('base64')
  return { privateKeyPem, publicKeyPem, publicKeyDerBase64 }
}

function ww2KeyMaterial(): KeyMaterial {
  return keyMaterialFromPrivateKey(
    normalizePem(
      process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM,
      'WEDDING_DAY_WW2_PRIVATE_KEY_PEM',
    ),
  )
}

function rootKeyMaterial(): KeyMaterial {
  return keyMaterialFromPrivateKey(
    normalizePem(
      process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM,
      'WEDDING_DAY_ROOT_PRIVATE_KEY_PEM',
    ),
  )
}

function p1363HexSign(payload: string, privateKeyPem: string): string {
  return cryptoSign('sha256', Buffer.from(payload, 'utf8'), {
    key: privateKeyPem,
    dsaEncoding: 'ieee-p1363',
  }).toString('hex')
}

function p1363HexVerify(
  payload: string,
  signatureHex: string,
  publicKeyPem: string,
): boolean {
  if (!/^[0-9a-f]{128}$/i.test(signatureHex)) return false
  try {
    return cryptoVerify(
      'sha256',
      Buffer.from(payload, 'utf8'),
      { key: publicKeyPem, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureHex, 'hex'),
    )
  } catch {
    return false
  }
}

export function weddingShortId(weddingId: string): string {
  return createHash('sha256').update(weddingId).digest('hex').slice(0, 8)
}

function deterministicPassSerial(weddingId: string, guestId: string): string {
  const suffix = createHash('sha256')
    .update(`${weddingId}:${guestId}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()
  return `WW${suffix}`
}

export function canonicalWw2Payload(input: {
  weddingShortId: string
  passSerial: string
  eventBitmask: number
  nonce: string
}): string {
  const mask = input.eventBitmask.toString(16).padStart(2, '0').toLowerCase()
  return `${WW2_VERSION}.${input.weddingShortId}.${input.passSerial}.${mask}.${input.nonce}`
}

export function parseWw2Token(token: string): ParsedWw2Token | null {
  const parts = token.trim().split('.')
  if (parts.length !== 6 || parts[0] !== WW2_VERSION) return null
  const eventBitmask = Number.parseInt(parts[3], 16)
  if (!Number.isInteger(eventBitmask) || eventBitmask < 0 || eventBitmask > 0xff) {
    return null
  }
  if (!parts[1] || !parts[2] || !parts[4] || !/^[0-9a-f]{128}$/i.test(parts[5])) {
    return null
  }
  const canonicalPayload = canonicalWw2Payload({
    weddingShortId: parts[1],
    passSerial: parts[2],
    eventBitmask,
    nonce: parts[4],
  })
  return {
    version: WW2_VERSION,
    weddingShortId: parts[1],
    passSerial: parts[2],
    eventBitmask,
    nonce: parts[4],
    signatureHex: parts[5].toLowerCase(),
    canonicalPayload,
  }
}

function membershipRole(rawRole: string, dashboardRole: string): WeddingDayOperatorContext['role'] | null {
  const role = rawRole.toLowerCase()
  if (role === 'usher') return 'usher'
  if (role === 'vendor' || dashboardRole === 'vendor') return 'vendor'
  if (role === 'owner' || role === 'couple' || dashboardRole === 'couple') return 'couple'
  if (role === 'planner' || role === 'coordinator' || dashboardRole === 'planner') return 'planner'
  if (role === 'admin' || dashboardRole === 'admin') return 'admin'
  return null
}

export async function readWeddingDayOperator(
  request: NextRequest,
): Promise<WeddingDayOperatorContext | null> {
  const session = readAppSession(request)
  if (!session?.activeWeddingId) return null

  if (session.role === 'admin') {
    return {
      userId: session.userId,
      email: session.email,
      weddingId: session.activeWeddingId,
      role: 'admin',
    }
  }

  const rows = await db.$queryRawUnsafe<Array<{ role: string }>>(
    `SELECT role
       FROM public."WeddingMembership"
      WHERE "userId" = $1
        AND "weddingId" = $2
        AND status = 'active'
      LIMIT 1`,
    session.userId,
    session.activeWeddingId,
  )
  const resolvedRole = rows[0]
    ? membershipRole(rows[0].role, session.role)
    : null
  if (!resolvedRole) return null

  return {
    userId: session.userId,
    email: session.email,
    weddingId: session.activeWeddingId,
    role: resolvedRole,
  }
}

export async function requireWeddingDayOperator(
  request: NextRequest,
  allowedRoles: WeddingDayOperatorContext['role'][],
): Promise<WeddingDayOperatorContext | null> {
  const actor = await readWeddingDayOperator(request)
  return actor && allowedRoles.includes(actor.role) ? actor : null
}

async function guestEligibility(
  weddingId: string,
  guestId: string,
): Promise<GuestEligibilityRow | null> {
  const rows = await db.$queryRawUnsafe<GuestEligibilityRow[]>(
    `SELECT g.id AS "guestId",
            g.name AS "guestName",
            w.id AS "weddingId",
            w.slug AS "weddingSlug",
            w.title AS "weddingTitle",
            w.date AS "weddingDate",
            w.venue,
            r.attending,
            r."plusOne",
            r."plusOneName",
            r."kidsAttending",
            r."kidsCount",
            g."tableNumber"
       FROM public."Guest" g
       JOIN public."Wedding" w ON w.id = g."weddingId"
       LEFT JOIN public."RSVP" r ON r."guestId" = g.id
      WHERE g.id = $1 AND g."weddingId" = $2
      LIMIT 1`,
    guestId,
    weddingId,
  )
  return rows[0] ?? null
}

function householdMembers(row: GuestEligibilityRow): HouseholdMember[] {
  const members: HouseholdMember[] = [
    {
      attendeeKey: 'primary',
      attendeeKind: 'primary',
      attendeeName: row.guestName,
    },
  ]
  if (row.plusOne) {
    members.push({
      attendeeKey: 'plus-one',
      attendeeKind: 'plus_one',
      attendeeName: row.plusOneName?.trim() || 'Guest partner / +1',
    })
  }
  if (row.kidsAttending && row.kidsCount > 0) {
    for (let index = 1; index <= row.kidsCount; index += 1) {
      members.push({
        attendeeKey: `child-${index}`,
        attendeeKind: 'child',
        attendeeName: `Child ${index}`,
      })
    }
  }
  return members
}

async function ensurePassKey(weddingId: string): Promise<PassKeyRow> {
  const keyId = process.env.WEDDING_DAY_WW2_KEY_ID?.trim() || 'ww2-isolated-v1'
  const material = ww2KeyMaterial()
  const existing = await db.$queryRawUnsafe<PassKeyRow[]>(
    `SELECT * FROM public."WeddingPassKey"
      WHERE "weddingId" = $1 AND "keyId" = $2
      LIMIT 1`,
    weddingId,
    keyId,
  )
  if (existing[0]) {
    if (
      existing[0].publicKeyDerBase64 !== material.publicKeyDerBase64 ||
      existing[0].status !== 'active' ||
      existing[0].revokedAt
    ) {
      throw new Error(
        '[wewed:wedding-day] Configured WW2 key does not match the active wedding key record.',
      )
    }
    return existing[0]
  }

  const id = randomUUID()
  const rows = await db.$queryRawUnsafe<PassKeyRow[]>(
    `INSERT INTO public."WeddingPassKey"
      (id, "weddingId", "keyId", algorithm, "publicKeyPem", "publicKeyDerBase64",
       status, "activeFrom", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("weddingId", "keyId") DO UPDATE
       SET "updatedAt" = CURRENT_TIMESTAMP
     RETURNING *`,
    id,
    weddingId,
    keyId,
    WW2_ALGORITHM,
    material.publicKeyPem,
    material.publicKeyDerBase64,
  )
  const key = rows[0]
  if (!key || key.publicKeyDerBase64 !== material.publicKeyDerBase64) {
    throw new Error('[wewed:wedding-day] Failed to establish the configured WW2 public key.')
  }
  return key
}

export async function ensureWeddingPassCredential(input: {
  weddingId: string
  guestId: string
}): Promise<CredentialRow> {
  const eligibility = await guestEligibility(input.weddingId, input.guestId)
  if (!eligibility || eligibility.attending !== true) {
    throw new Error('Wedding Pass is available only after an accepted RSVP.')
  }

  const existing = await db.$queryRawUnsafe<CredentialRow[]>(
    `SELECT * FROM public."WeddingPassCredential"
      WHERE "weddingId" = $1
        AND "guestId" = $2
        AND "revokedAt" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)
      ORDER BY "issuedAt" DESC
      LIMIT 1`,
    input.weddingId,
    input.guestId,
  )
  if (existing[0]) return existing[0]

  const passKey = await ensurePassKey(input.weddingId)
  const material = ww2KeyMaterial()
  const shortId = weddingShortId(input.weddingId)
  const passSerial = deterministicPassSerial(input.weddingId, input.guestId)
  const nonce = randomBytes(4).toString('hex')
  const eventBitmask = DEFAULT_WW2_EVENT_MASK
  const payload = canonicalWw2Payload({
    weddingShortId: shortId,
    passSerial,
    eventBitmask,
    nonce,
  })
  const signatureHex = p1363HexSign(payload, material.privateKeyPem)
  const token = `${payload}.${signatureHex}`
  const weddingExpiry = eligibility.weddingDate.getTime() + 36 * 60 * 60 * 1000
  const expiresAt = new Date(Math.max(weddingExpiry, Date.now() + 12 * 60 * 60 * 1000))

  const id = randomUUID()
  const rows = await db.$queryRawUnsafe<CredentialRow[]>(
    `INSERT INTO public."WeddingPassCredential"
      (id, "weddingId", "guestId", "passKeyId", "weddingShortId", "passSerial",
       "tokenVersion", "eventBitmask", nonce, "signatureHex", token, "issuedAt",
       "expiresAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             CURRENT_TIMESTAMP, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("weddingId", "passSerial") DO UPDATE
       SET "updatedAt" = CURRENT_TIMESTAMP
     RETURNING *`,
    id,
    input.weddingId,
    input.guestId,
    passKey.id,
    shortId,
    passSerial,
    WW2_VERSION,
    eventBitmask,
    nonce,
    signatureHex,
    token,
    expiresAt,
  )
  return rows[0]
}

export async function verifyWeddingPassToken(input: {
  weddingId: string
  token: string
  requiredEventBit?: number
}): Promise<CredentialRow> {
  const parsed = parseWw2Token(input.token)
  if (!parsed || parsed.weddingShortId !== weddingShortId(input.weddingId)) {
    throw new Error('INVALID_WEDDING_PASS')
  }
  const requiredBit = input.requiredEventBit ?? WEDDING_DAY_EVENT_BIT
  if ((parsed.eventBitmask & requiredBit) === 0) {
    throw new Error('PASS_NOT_AUTHORIZED_FOR_EVENT')
  }

  const rows = await db.$queryRawUnsafe<Array<CredentialRow & { publicKeyPem: string; keyStatus: string; keyExpiresAt: Date | null; keyRevokedAt: Date | null }>>(
    `SELECT c.*, k."publicKeyPem", k.status AS "keyStatus",
            k."expiresAt" AS "keyExpiresAt", k."revokedAt" AS "keyRevokedAt"
       FROM public."WeddingPassCredential" c
       JOIN public."WeddingPassKey" k ON k.id = c."passKeyId"
      WHERE c."weddingId" = $1 AND c.token = $2
      LIMIT 1`,
    input.weddingId,
    input.token,
  )
  const credential = rows[0]
  const now = Date.now()
  if (
    !credential ||
    credential.revokedAt ||
    (credential.expiresAt && credential.expiresAt.getTime() <= now) ||
    credential.keyStatus !== 'active' ||
    credential.keyRevokedAt ||
    (credential.keyExpiresAt && credential.keyExpiresAt.getTime() <= now)
  ) {
    throw new Error('PASS_REVOKED_OR_EXPIRED')
  }
  if (
    credential.passSerial !== parsed.passSerial ||
    credential.nonce !== parsed.nonce ||
    credential.eventBitmask !== parsed.eventBitmask ||
    credential.signatureHex.toLowerCase() !== parsed.signatureHex ||
    !p1363HexVerify(parsed.canonicalPayload, parsed.signatureHex, credential.publicKeyPem)
  ) {
    throw new Error('INVALID_WEDDING_PASS_SIGNATURE')
  }
  return credential
}

/** Revalidate rotation on every guest operation, not merely the cookie signature. */
async function currentWeddingDayGuest(request: NextRequest) {
  const session = readWeddingGuestSession(request)
  if (!session) return null
  const record = await db.guest.findFirst({
    where: { id: session.guestId, weddingId: session.weddingId },
    select: { id: true, weddingId: true, tableNumber: true,
      seatingTable: { select: { name: true, weddingId: true } },
      rsvp: { select: { token: true, attending: true, checkedIn: true, checkedInAt: true } } },
  })
  if (!record?.rsvp || !guestSessionMatchesInvitation(session, {
    weddingId: record.weddingId, guestId: record.id, rsvpToken: record.rsvp.token,
  })) return null
  return record
}

export async function readWeddingDayGuestContext(request: NextRequest) {
  const guest = await currentWeddingDayGuest(request)
  if (!guest) return null
  if (guest.rsvp?.attending !== true) throw new Error('ATTENDANCE_REQUIRED')
  const eligibility = await guestEligibility(guest.weddingId, guest.id)
  if (!eligibility || eligibility.attending !== true) return null
  return {
    actorRole: 'guest' as const,
    guest: {
      id: eligibility.guestId, name: eligibility.guestName, attending: true,
      tableNumber: guest.tableNumber,
      tableName: guest.seatingTable?.weddingId === guest.weddingId ? guest.seatingTable.name : null,
      household: householdMembers(eligibility),
      checkedIn: guest.rsvp.checkedIn, checkedInAt: guest.rsvp.checkedInAt,
    },
    wedding: {
      id: eligibility.weddingId, slug: eligibility.weddingSlug, title: eligibility.weddingTitle,
      date: eligibility.weddingDate, venue: eligibility.venue,
    },
    announcements: (await activeAnnouncements(guest.weddingId, 'guest')).map(({ id, title, body, publishedAt }) => ({ id, title, body, publishedAt })),
  }
}

export async function guestPassForRequest(request: NextRequest) {
  const guest = await currentWeddingDayGuest(request)
  if (!guest) return null
  if (guest.rsvp?.attending !== true) throw new Error('ATTENDANCE_REQUIRED')
  const credential = await ensureWeddingPassCredential({ weddingId: guest.weddingId, guestId: guest.id })
  if (credential.revokedAt || (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())) {
    throw new Error('PASS_UNAVAILABLE')
  }
  const keys = await db.$queryRawUnsafe<PassKeyRow[]>(
    `SELECT * FROM public."WeddingPassKey" WHERE id = $1 AND "weddingId" = $2 AND "revokedAt" IS NULL`,
    credential.passKeyId, guest.weddingId,
  )
  const key = keys[0]
  if (!key || (key.expiresAt && key.expiresAt.getTime() <= Date.now())) throw new Error('PASS_UNAVAILABLE')
  return { ...credential, publicKeyDerBase64: key.publicKeyDerBase64, algorithm: WW2_ALGORITHM }
}

export async function checkInWeddingGuest(input: {
  weddingId: string
  guestId?: string
  token?: string
  attendeeKeys?: string[]
  actorUserId: string
  source: 'qr' | 'manual' | 'offline-sync'
  gateId?: string | null
  deviceId?: string | null
  clientEventId?: string | null
  eventKey?: string
}): Promise<WeddingCheckInResult> {
  const eventKey = input.eventKey?.trim() || WEDDING_DAY_EVENT_KEY
  let credential: CredentialRow | null = null
  let guestId = input.guestId?.trim() || ''
  if (input.token) {
    credential = await verifyWeddingPassToken({
      weddingId: input.weddingId,
      token: input.token,
    })
    if (guestId && guestId !== credential.guestId) throw new Error('PASS_GUEST_MISMATCH')
    guestId = credential.guestId
  }
  if (!guestId) throw new Error('GUEST_REQUIRED')

  const eligibility = await guestEligibility(input.weddingId, guestId)
  if (!eligibility || eligibility.attending !== true) throw new Error('GUEST_NOT_ELIGIBLE')
  const household = householdMembers(eligibility)
  const requestedKeys = input.attendeeKeys?.length
    ? [...new Set(input.attendeeKeys)]
    : household.map((member) => member.attendeeKey)
  const memberByKey = new Map(household.map((member) => [member.attendeeKey, member]))
  const selected = requestedKeys.map((key) => memberByKey.get(key)).filter(Boolean) as HouseholdMember[]
  if (selected.length !== requestedKeys.length) throw new Error('INVALID_HOUSEHOLD_MEMBER')

  const results = await db.$transaction(async (tx) => {
    const output: CheckInResultItem[] = []
    for (const member of selected) {
      const id = randomUUID()
      const offlineEventId = input.clientEventId
        ? `${input.clientEventId}:${member.attendeeKey}`
        : null
      const inserted = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO public."WeddingCheckIn"
          (id, "weddingId", "guestId", "credentialId", "eventKey", "attendeeKey",
           "attendeeKind", "attendeeName", source, "gateId", "deviceId",
           "clientEventId", "admittedByUserId", "admittedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("weddingId", "eventKey", "guestId", "attendeeKey") DO NOTHING
         RETURNING id`,
        id,
        input.weddingId,
        guestId,
        credential?.id ?? null,
        eventKey,
        member.attendeeKey,
        member.attendeeKind,
        member.attendeeName,
        input.source,
        input.gateId ?? null,
        input.deviceId ?? null,
        offlineEventId,
        input.actorUserId,
      )
      output.push({
        attendeeKey: member.attendeeKey,
        attendeeName: member.attendeeName,
        result: inserted.length ? 'ADMITTED' : 'ALREADY_CHECKED_IN',
      })
    }

    const totals = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count
         FROM public."WeddingCheckIn"
        WHERE "weddingId" = $1 AND "guestId" = $2 AND "eventKey" = $3`,
      input.weddingId,
      guestId,
      eventKey,
    )
    const checkedInPeople = Number(totals[0]?.count ?? 0)
    const complete = checkedInPeople >= household.length
    await tx.$executeRawUnsafe(
      `UPDATE public."RSVP"
          SET "checkedIn" = $1,
              "checkedInAt" = CASE
                WHEN $1 THEN COALESCE("checkedInAt", CURRENT_TIMESTAMP)
                ELSE NULL
              END,
              "updatedAt" = CURRENT_TIMESTAMP
        WHERE "guestId" = $2`,
      complete,
      guestId,
    )
    return { output, checkedInPeople, complete }
  })

  return {
    guestId,
    eventKey,
    results: results.output,
    checkedInPeople: results.checkedInPeople,
    expectedPeople: household.length,
    householdComplete: results.complete,
  }
}

export async function plannerWeddingDayState(weddingId: string) {
  const attendance = await db.$queryRawUnsafe<
    Array<{ expectedPeople: bigint; checkedInPeople: bigint }>
  >(
    `SELECT
       COALESCE((
         SELECT SUM(
           1
           + CASE WHEN r."plusOne" THEN 1 ELSE 0 END
           + CASE WHEN r."kidsAttending" THEN r."kidsCount" ELSE 0 END
         )::bigint
           FROM public."RSVP" r
           JOIN public."Guest" g ON g.id = r."guestId"
          WHERE g."weddingId" = $1 AND r.attending = TRUE
       ), 0)::bigint AS "expectedPeople",
       COALESCE((
         SELECT COUNT(*)::bigint
           FROM public."WeddingCheckIn" c
          WHERE c."weddingId" = $1 AND c."eventKey" = $2
       ), 0)::bigint AS "checkedInPeople"`,
    weddingId,
    WEDDING_DAY_EVENT_KEY,
  )

  const vendorTotals = await db.$queryRawUnsafe<
    Array<{ expectedVendors: bigint; vendorsOnsite: bigint }>
  >(
    `SELECT
       (SELECT COUNT(DISTINCT se."vendorId")::bigint
          FROM public."ServiceEngagement" se
         WHERE se."weddingId" = $1) AS "expectedVendors",
       (SELECT COUNT(DISTINCT wsp."vendorId")::bigint
          FROM public."WeddingServicePresence" wsp
         WHERE wsp."weddingId" = $1
           AND wsp.state IN ('ARRIVED_ON_SITE', 'SERVICE_ACTIVE', 'COMPLETED')) AS "vendorsOnsite"`,
    weddingId,
  )

  const [programme, tasks, announcements, vendors] = await Promise.all([
    db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, time, title, description, location, "order"
         FROM public."ProgrammeItem"
        WHERE "weddingId" = $1
        ORDER BY "order" ASC, id ASC
        LIMIT 5`,
      weddingId,
    ),
    db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, title, status, priority, "dueDate", assignee
         FROM public."PlannerTask"
        WHERE "weddingId" = $1
          AND LOWER(status) NOT IN ('done', 'complete', 'completed')
        ORDER BY CASE LOWER(priority)
                   WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                 "dueDate" ASC NULLS LAST, "order" ASC
        LIMIT 8`,
      weddingId,
    ),
    activeAnnouncements(weddingId, 'planner'),
    db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT se.id AS "serviceEngagementId", se."vendorId", v.name AS "vendorName",
              se."serviceCategory", se."serviceDescription",
              COALESCE(wsp.state, 'CONFIRMED') AS state,
              wsp."changedAt", wsp.version
         FROM public."ServiceEngagement" se
         JOIN public."Vendor" v ON v.id = se."vendorId" AND v."weddingId" = se."weddingId"
         LEFT JOIN public."WeddingServicePresence" wsp
           ON wsp."serviceEngagementId" = se.id AND wsp."weddingId" = se."weddingId"
        WHERE se."weddingId" = $1
        ORDER BY v.name ASC, se."serviceCategory" ASC`,
      weddingId,
    ),
  ])

  const expectedPeople = Number(attendance[0]?.expectedPeople ?? 0)
  const checkedInPeople = Number(attendance[0]?.checkedInPeople ?? 0)
  return {
    attendance: {
      expectedPeople,
      checkedInPeople,
      remainingPeople: Math.max(0, expectedPeople - checkedInPeople),
    },
    vendors: {
      expected: Number(vendorTotals[0]?.expectedVendors ?? 0),
      onsite: Number(vendorTotals[0]?.vendorsOnsite ?? 0),
      services: vendors,
    },
    programme,
    tasks,
    announcements,
  }
}

export async function activeAnnouncements(
  weddingId: string,
  audience: 'guest' | 'planner' | 'vendor' | 'all',
) {
  return db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, audience, title, body, status, metadata, "publishedAt", "expiresAt"
       FROM public."WeddingAnnouncement"
      WHERE "weddingId" = $1
        AND status = 'published'
        AND "publishedAt" <= CURRENT_TIMESTAMP
        AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)
        AND (audience = 'all' OR audience = $2)
      ORDER BY "publishedAt" DESC, id DESC`,
    weddingId,
    audience,
  )
}

export async function createWeddingAnnouncement(input: {
  weddingId: string
  authorUserId: string
  audience: 'all' | 'guest' | 'planner' | 'vendor'
  title?: string | null
  body: string
  expiresAt?: Date | null
}) {
  const id = randomUUID()
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `INSERT INTO public."WeddingAnnouncement"
      (id, "weddingId", "authorUserId", audience, title, body, status,
       "publishedAt", "expiresAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, 'published', CURRENT_TIMESTAMP, $7,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id, audience, title, body, status, "publishedAt", "expiresAt"`,
    id,
    input.weddingId,
    input.authorUserId,
    input.audience,
    input.title?.trim() || null,
    input.body.trim(),
    input.expiresAt ?? null,
  )
  return rows[0]
}

export async function transitionVendorPresence(input: {
  weddingId: string
  serviceEngagementId: string
  actor: WeddingDayOperatorContext
  state: WeddingServicePresenceState
  notes?: string | null
}) {
  if (!PRESENCE_STATES.includes(input.state)) throw new Error('INVALID_VENDOR_PRESENCE_STATE')
  const services = await db.$queryRawUnsafe<
    Array<{
      serviceEngagementId: string
      vendorId: string
      vendorEmail: string | null
      currentState: string | null
      version: number | null
    }>
  >(
    `SELECT se.id AS "serviceEngagementId", se."vendorId", v.email AS "vendorEmail",
            wsp.state AS "currentState", wsp.version
       FROM public."ServiceEngagement" se
       JOIN public."Vendor" v ON v.id = se."vendorId" AND v."weddingId" = se."weddingId"
       LEFT JOIN public."WeddingServicePresence" wsp
         ON wsp."serviceEngagementId" = se.id AND wsp."weddingId" = se."weddingId"
      WHERE se.id = $1 AND se."weddingId" = $2
      LIMIT 1`,
    input.serviceEngagementId,
    input.weddingId,
  )
  const service = services[0]
  if (!service) throw new Error('SERVICE_ENGAGEMENT_NOT_FOUND')

  if (input.actor.role === 'vendor') {
    if (!service.vendorEmail || service.vendorEmail.toLowerCase() !== input.actor.email.toLowerCase()) {
      throw new Error('VENDOR_SERVICE_FORBIDDEN')
    }
    const current = (service.currentState || 'CONFIRMED') as WeddingServicePresenceState
    const currentIndex = PRESENCE_STATES.indexOf(current)
    const nextIndex = PRESENCE_STATES.indexOf(input.state)
    if (nextIndex !== currentIndex && nextIndex !== currentIndex + 1) {
      throw new Error('INVALID_VENDOR_PRESENCE_TRANSITION')
    }
  }

  const id = randomUUID()
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `INSERT INTO public."WeddingServicePresence"
      (id, "weddingId", "vendorId", "serviceEngagementId", state,
       "changedByUserId", "changedAt", notes, version, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, 1,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("weddingId", "serviceEngagementId") DO UPDATE
       SET state = EXCLUDED.state,
           "changedByUserId" = EXCLUDED."changedByUserId",
           "changedAt" = CURRENT_TIMESTAMP,
           notes = EXCLUDED.notes,
           version = "WeddingServicePresence".version + 1,
           "updatedAt" = CURRENT_TIMESTAMP
     RETURNING id, "vendorId", "serviceEngagementId", state, "changedAt", notes, version`,
    id,
    input.weddingId,
    service.vendorId,
    input.serviceEngagementId,
    input.state,
    input.actor.userId,
    input.notes?.trim() || null,
  )
  return rows[0]
}

export async function signedWeddingDayManifest(weddingId: string) {
  const weddings = await db.$queryRawUnsafe<Array<{ id: string; slug: string }>>(
    `SELECT id, slug FROM public."Wedding" WHERE id = $1 LIMIT 1`,
    weddingId,
  )
  if (!weddings[0]) throw new Error('WEDDING_NOT_FOUND')
  const [keys, credentials] = await Promise.all([
    db.$queryRawUnsafe<PassKeyRow[]>(
      `SELECT * FROM public."WeddingPassKey"
        WHERE "weddingId" = $1
        ORDER BY "activeFrom" DESC`,
      weddingId,
    ),
    db.$queryRawUnsafe<CredentialRow[]>(
      `SELECT * FROM public."WeddingPassCredential"
        WHERE "weddingId" = $1
        ORDER BY "issuedAt" ASC`,
      weddingId,
    ),
  ])
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  const payload = {
    manifestVersion: 1,
    tokenVersion: WW2_VERSION,
    weddingId,
    weddingShortId: weddingShortId(weddingId),
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    keys: keys.map((key) => ({
      keyId: key.keyId,
      algorithm: WW2_ALGORITHM,
      publicKeyDerBase64: key.publicKeyDerBase64,
      status: key.status,
      activeFrom: key.activeFrom.toISOString(),
      expiresAt: key.expiresAt?.toISOString() ?? null,
      revokedAt: key.revokedAt?.toISOString() ?? null,
    })),
    credentials: credentials.map((credential) => ({
      passSerial: credential.passSerial,
      nonce: credential.nonce,
      eventBitmask: credential.eventBitmask,
      expiresAt: credential.expiresAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null,
    })),
  }
  const canonicalPayload = JSON.stringify(payload)
  const root = rootKeyMaterial()
  const signatureHex = p1363HexSign(canonicalPayload, root.privateKeyPem)
  return {
    rootKeyId: process.env.WEDDING_DAY_ROOT_KEY_ID?.trim() || 'wewed-root-isolated-v1',
    algorithm: WW2_ALGORITHM,
    payload,
    canonicalPayload,
    signatureHex,
  }
}

export function verifySignedWeddingDayManifest(input: {
  canonicalPayload: string
  signatureHex: string
  trustedRootPublicKeyPem: string
}): boolean {
  return p1363HexVerify(
    input.canonicalPayload,
    input.signatureHex,
    input.trustedRootPublicKeyPem,
  )
}
