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
import { isWeddingDayWW2Enabled } from '@/lib/wedding-day-feature'
import { readWeddingGuestSession } from '@/lib/wedding-guest-session'

export const WW2_VERSION = 'WW2'
export const WW2_ALGORITHM = 'ECDSA_P256_SHA256'
export const WEDDING_DAY_EVENT_KEY = 'wedding-day'
export const WEDDING_DAY_EVENT_BIT = 0x04
export const DEFAULT_WW2_EVENT_MASK = 0x0e

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export const WEDDING_PASS_OPENS_BEFORE_MS = 14 * DAY_MS
export const WEDDING_PASS_ISSUANCE_CUTOFF_AFTER_MS = 24 * HOUR_MS
export const WEDDING_PASS_EXPIRES_AFTER_MS = 36 * HOUR_MS

export interface WeddingPassIssuanceWindow {
  opensAt: Date
  cutoffAt: Date
  expiresAt: Date
}

export interface ParsedWw2Token {
  version: 'WW2'
  weddingShortId: string
  passSerial: string
  eventBitmask: number
  nonce: string
  signatureHex: string
  payload: string
}

export interface PassKeyRow {
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

export interface CredentialRow {
  id: string
  weddingId: string
  guestId: string
  passKeyId: string
  weddingShortId: string
  passSerial: string
  issueSeq: number
  tokenVersion: string
  eventBitmask: number
  nonce: string
  signatureHex: string
  token: string
  issuedAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  revocationReason: string | null
  supersededAt: Date | null
}

export interface WeddingCheckInResult {
  success: boolean
  admittedCount: number
  guestId: string
  attendeeKeys: string[]
  checkIns: Array<{
    id: string
    attendeeKey: string
    attendeeKind: string
    attendeeName: string
    admittedAt: string
  }>
}

export function weddingShortId(weddingId: string): string {
  return createHash('sha256').update(weddingId).digest('hex').slice(0, 8)
}

export function weddingPassIssuanceWindow(weddingDate: Date): WeddingPassIssuanceWindow {
  const anchor = weddingDate.getTime()
  return {
    opensAt: new Date(anchor - WEDDING_PASS_OPENS_BEFORE_MS),
    cutoffAt: new Date(anchor + WEDDING_PASS_ISSUANCE_CUTOFF_AFTER_MS),
    expiresAt: new Date(anchor + WEDDING_PASS_EXPIRES_AFTER_MS),
  }
}

export function weddingPassIssuanceAllowedAt(
  weddingDate: Date,
  now: Date = new Date(),
): boolean {
  const window = weddingPassIssuanceWindow(weddingDate)
  const time = now.getTime()
  return time >= window.opensAt.getTime() && time <= window.cutoffAt.getTime()
}

export function canonicalWw2Payload(input: {
  weddingShortId: string
  passSerial: string
  eventBitmask: number
  nonce: string
}): string {
  const mask = input.eventBitmask.toString(16).padStart(2, '0').toLowerCase()
  return [
    WW2_VERSION,
    input.weddingShortId,
    input.passSerial,
    mask,
    input.nonce,
  ].join(':')
}

export function parseWw2Token(token: string): ParsedWw2Token | null {
  const [payload, signatureHex, extra] = token.split('.')
  if (!payload || !signatureHex || extra) return null
  const parts = payload.split(':')
  if (parts.length !== 5) return null
  const [version, weddingShortId, passSerial, maskHex, nonce] = parts
  if (version !== WW2_VERSION) return null
  const eventBitmask = Number.parseInt(maskHex, 16)
  if (!Number.isFinite(eventBitmask)) return null
  return {
    version: WW2_VERSION,
    weddingShortId,
    passSerial,
    eventBitmask,
    nonce,
    signatureHex,
    payload,
  }
}

function p1363HexSign(payload: string, privateKeyPem: string): string {
  const privateKey = createPrivateKey(privateKeyPem)
  return cryptoSign('sha256', Buffer.from(payload, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('hex')
}

function p1363HexVerify(payload: string, signatureHex: string, publicKeyPem: string): boolean {
  try {
    const publicKey = createPublicKey(publicKeyPem)
    const signature = Buffer.from(signatureHex, 'hex')
    return cryptoVerify(
      'sha256',
      Buffer.from(payload, 'utf8'),
      {
        key: publicKey,
        dsaEncoding: 'ieee-p1363',
      },
      signature,
    )
  } catch {
    return false
  }
}

function ww2KeyMaterial(): { privateKeyPem: string; keyId: string } {
  const privateKeyPem = process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM?.trim().replace(/\\n/g, '\n')
  const keyId = process.env.WEDDING_DAY_WW2_KEY_ID?.trim()
  if (!privateKeyPem || !keyId) {
    throw new Error('WEDDING_DAY_WW2_KEY_UNAVAILABLE')
  }
  return { privateKeyPem, keyId }
}

export async function ensurePassKey(weddingId: string): Promise<PassKeyRow> {
  const { privateKeyPem, keyId } = ww2KeyMaterial()
  const privateKey = createPrivateKey(privateKeyPem)
  const publicKey = createPublicKey(privateKey)
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const publicKeyDerBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')

  const existing = await db.$queryRawUnsafe<PassKeyRow[]>(
    `SELECT * FROM public."WeddingPassKey"
      WHERE "weddingId" = $1 AND "keyId" = $2
      LIMIT 1`,
    weddingId,
    keyId,
  )
  if (existing[0]) return existing[0]

  const id = randomUUID()
  const rows = await db.$queryRawUnsafe<PassKeyRow[]>(
    `INSERT INTO public."WeddingPassKey"
       (id, "weddingId", "keyId", algorithm, "publicKeyPem", "publicKeyDerBase64", status, "activeFrom", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, 'active', now(), now(), now())
     ON CONFLICT ("weddingId", "keyId") DO UPDATE
       SET "publicKeyPem" = EXCLUDED."publicKeyPem",
           "publicKeyDerBase64" = EXCLUDED."publicKeyDerBase64",
           "updatedAt" = now()
     RETURNING *`,
    id,
    weddingId,
    keyId,
    WW2_ALGORITHM,
    publicKeyPem,
    publicKeyDerBase64,
  )
  return rows[0]
}

async function guestEligibility(
  weddingId: string,
  guestId: string,
): Promise<{ attending: boolean | null; weddingDate: Date } | null> {
  const rows = await db.$queryRawUnsafe<Array<{ attending: boolean | null; date: Date }>>(
    `SELECT r.attending, w.date
       FROM public."Guest" g
       JOIN public."Wedding" w ON w.id = g."weddingId"
       LEFT JOIN public."RSVP" r ON r."guestId" = g.id
      WHERE g.id = $1 AND g."weddingId" = $2
      LIMIT 1`,
    guestId,
    weddingId,
  )
  const row = rows[0]
  if (!row) return null
  return { attending: row.attending, weddingDate: row.date }
}

async function liveCredential(
  tx: Pick<typeof db, '$queryRawUnsafe'>,
  weddingId: string,
  guestId: string,
  lock: boolean,
): Promise<CredentialRow | null> {
  const rows = await tx.$queryRawUnsafe<CredentialRow[]>(
    `SELECT * FROM public."WeddingPassCredential"
      WHERE "weddingId" = $1
        AND "guestId" = $2
        AND "revokedAt" IS NULL
        AND "supersededAt" IS NULL
      ORDER BY "issueSeq" DESC
      LIMIT 1
      ${lock ? 'FOR UPDATE' : ''}`,
    weddingId,
    guestId,
  )
  return rows[0] ?? null
}

function credentialIsUsable(credential: CredentialRow, now: number): boolean {
  if (credential.revokedAt || credential.supersededAt) return false
  return !credential.expiresAt || credential.expiresAt.getTime() > now
}

function isUniqueViolation(error: unknown): boolean {
  if (!error) return false
  const msg = String(error)
  return msg.includes('23505') || msg.includes('unique constraint') || msg.includes('Unique constraint') || msg.includes('P2002')
}

export async function ensureWeddingPassCredential(input: {
  weddingId: string
  guestId: string
  now?: Date
}): Promise<CredentialRow> {
  if (!isWeddingDayWW2Enabled()) {
    throw new Error('WEDDING_DAY_DISABLED')
  }

  const eligibility = await guestEligibility(input.weddingId, input.guestId)
  if (!eligibility || eligibility.attending !== true) {
    throw new Error('Wedding Pass is available only after an accepted RSVP.')
  }

  const now = input.now ?? new Date()
  const window = weddingPassIssuanceWindow(eligibility.weddingDate)

  const issue = async (): Promise<CredentialRow> =>
    db.$transaction(async (tx) => {
      const existing = await liveCredential(tx, input.weddingId, input.guestId, true)
      if (existing && credentialIsUsable(existing, now.getTime())) return existing

      if (!weddingPassIssuanceAllowedAt(eligibility.weddingDate, now)) {
        throw new Error('PASS_ISSUANCE_CLOSED')
      }

      if (existing) {
        await tx.$queryRawUnsafe(
          `UPDATE public."WeddingPassCredential"
              SET "supersededAt" = $1, "updatedAt" = $1
            WHERE id = $2`,
          now,
          existing.id,
        )
      }

      const seqRows = await tx.$queryRawUnsafe<Array<{ next: number }>>(
        `SELECT COALESCE(MAX("issueSeq"), 0) + 1 AS next
           FROM public."WeddingPassCredential"
          WHERE "weddingId" = $1 AND "guestId" = $2`,
        input.weddingId,
        input.guestId,
      )
      const issueSeq = Number(seqRows[0]?.next ?? 1)

      const passKey = await ensurePassKey(input.weddingId)
      const material = ww2KeyMaterial()
      const shortId = weddingShortId(input.weddingId)
      // Pass serial is non-deterministic with random 4-byte uppercase hex + sequence
      const passSerial = `WW${randomBytes(4).toString('hex').toUpperCase()}-${String(issueSeq).padStart(3, '0')}`
      const nonce = randomBytes(8).toString('hex')
      const eventBitmask = DEFAULT_WW2_EVENT_MASK
      const payload = canonicalWw2Payload({
        weddingShortId: shortId,
        passSerial,
        eventBitmask,
        nonce,
      })
      const signatureHex = p1363HexSign(payload, material.privateKeyPem)
      const token = `${payload}.${signatureHex}`

      const rows = await tx.$queryRawUnsafe<CredentialRow[]>(
        `INSERT INTO public."WeddingPassCredential"
          (id, "weddingId", "guestId", "passKeyId", "weddingShortId", "passSerial", "issueSeq",
           "tokenVersion", "eventBitmask", nonce, "signatureHex", token, "issuedAt",
           "expiresAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $13, $13)
         RETURNING *`,
        randomUUID(),
        input.weddingId,
        input.guestId,
        passKey.id,
        shortId,
        passSerial,
        issueSeq,
        WW2_VERSION,
        eventBitmask,
        nonce,
        signatureHex,
        token,
        now,
        window.expiresAt,
      )
      return rows[0]
    })

  try {
    return await issue()
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const winner = await liveCredential(db, input.weddingId, input.guestId, false)
    if (winner) return winner
    throw error
  }
}

export async function verifyWeddingPassToken(input: {
  weddingId: string
  token: string
  requiredEventBit?: number
}): Promise<CredentialRow> {
  if (!isWeddingDayWW2Enabled()) {
    throw new Error('WEDDING_DAY_DISABLED')
  }

  const parsed = parseWw2Token(input.token)
  if (!parsed) {
    throw new Error('INVALID_PASS_TOKEN')
  }

  const shortId = weddingShortId(input.weddingId)
  if (parsed.weddingShortId !== shortId) {
    throw new Error('PASS_WEDDING_MISMATCH')
  }

  const requiredBit = input.requiredEventBit ?? WEDDING_DAY_EVENT_BIT
  if ((parsed.eventBitmask & requiredBit) === 0) {
    throw new Error('PASS_EVENT_NOT_PERMITTED')
  }

  const credentials = await db.$queryRawUnsafe<CredentialRow[]>(
    `SELECT * FROM public."WeddingPassCredential"
      WHERE "weddingId" = $1 AND "passSerial" = $2
      LIMIT 1`,
    input.weddingId,
    parsed.passSerial,
  )
  const credential = credentials[0]
  if (!credential) {
    throw new Error('PASS_NOT_FOUND')
  }

  if (
    credential.revokedAt ||
    credential.supersededAt ||
    (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())
  ) {
    throw new Error('PASS_REVOKED_OR_EXPIRED')
  }

  const passKeys = await db.$queryRawUnsafe<PassKeyRow[]>(
    `SELECT * FROM public."WeddingPassKey"
      WHERE id = $1 AND "weddingId" = $2
      LIMIT 1`,
    credential.passKeyId,
    input.weddingId,
  )
  const passKey = passKeys[0]
  if (!passKey || passKey.status !== 'active' || passKey.revokedAt) {
    throw new Error('PASS_SIGNING_KEY_INACTIVE')
  }

  const verified = p1363HexVerify(parsed.payload, parsed.signatureHex, passKey.publicKeyPem)
  if (!verified) {
    throw new Error('PASS_SIGNATURE_INVALID')
  }

  return credential
}

export async function readWeddingDayGuestContext(request: NextRequest) {
  const session = readWeddingGuestSession(request)
  if (!session || session.version !== 2) return null

  const rows = await db.$queryRawUnsafe<Array<{
    guestId: string
    weddingId: string
    weddingSlug: string
    weddingTitle: string
    guestName: string
    attending: boolean | null
  }>>(
    `SELECT g.id AS "guestId", g."weddingId", w.slug AS "weddingSlug", w.title AS "weddingTitle",
            g.name AS "guestName", r.attending
       FROM public."Guest" g
       JOIN public."Wedding" w ON w.id = g."weddingId"
       LEFT JOIN public."RSVP" r ON r."guestId" = g.id
      WHERE g.id = $1 AND g."weddingId" = $2
      LIMIT 1`,
    session.guestId,
    session.weddingId,
  )
  const row = rows[0]
  if (!row) return null

  return {
    weddingId: row.weddingId,
    weddingSlug: row.weddingSlug,
    weddingTitle: row.weddingTitle,
    guestId: row.guestId,
    guestName: row.guestName,
    attending: row.attending,
  }
}

export async function guestPassForRequest(request: NextRequest) {
  if (!isWeddingDayWW2Enabled()) {
    return null
  }
  const context = await readWeddingDayGuestContext(request)
  if (!context || context.attending !== true) {
    return null
  }
  const credential = await ensureWeddingPassCredential({
    weddingId: context.weddingId,
    guestId: context.guestId,
  })
  return {
    context,
    credential,
  }
}

export async function checkInWeddingGuest(input: {
  weddingId: string
  gateId: string
  operatorUserId: string
  token?: string
  passSerial?: string
  attendeeKeys: string[]
  source?: string
  deviceId?: string
  clientEventId?: string
}): Promise<WeddingCheckInResult> {
  if (!isWeddingDayWW2Enabled()) {
    throw new Error('WEDDING_DAY_DISABLED')
  }

  if (!input.attendeeKeys || input.attendeeKeys.length === 0) {
    throw new Error('ATTENDEE_KEYS_REQUIRED')
  }

  let credential: CredentialRow
  if (input.token) {
    credential = await verifyWeddingPassToken({
      weddingId: input.weddingId,
      token: input.token,
    })
  } else if (input.passSerial) {
    const rows = await db.$queryRawUnsafe<CredentialRow[]>(
      `SELECT * FROM public."WeddingPassCredential"
        WHERE "weddingId" = $1 AND "passSerial" = $2
        LIMIT 1`,
      input.weddingId,
      input.passSerial,
    )
    const found = rows[0]
    if (!found) {
      throw new Error('PASS_NOT_FOUND')
    }
    if (
      found.revokedAt ||
      found.supersededAt ||
      (found.expiresAt && found.expiresAt.getTime() <= Date.now())
    ) {
      throw new Error('PASS_REVOKED_OR_EXPIRED')
    }
    credential = found
  } else {
    throw new Error('TOKEN_OR_SERIAL_REQUIRED')
  }

  const gateRows = await db.$queryRawUnsafe<Array<{ id: string; status: string }>>(
    `SELECT id, status FROM public."WeddingGate" WHERE id = $1 AND "weddingId" = $2 LIMIT 1`,
    input.gateId,
    input.weddingId,
  )
  if (!gateRows[0] || gateRows[0].status !== 'active') {
    throw new Error('GATE_INACTIVE_OR_INVALID')
  }

  const guestRows = await db.$queryRawUnsafe<Array<{
    guestId: string
    name: string
    attending: boolean | null
    plusOne: boolean | null
    plusOneName: string | null
    kidsAttending: boolean | null
    kidsCount: number | null
  }>>(
    `SELECT g.id AS "guestId", g.name, r.attending, r."plusOne", r."plusOneName",
            r."kidsAttending", r."kidsCount"
       FROM public."Guest" g
       LEFT JOIN public."RSVP" r ON r."guestId" = g.id
      WHERE g.id = $1 AND g."weddingId" = $2
      LIMIT 1`,
    credential.guestId,
    input.weddingId,
  )
  const guest = guestRows[0]
  if (!guest || guest.attending !== true) {
    throw new Error('GUEST_INELIGIBLE')
  }

  const validAttendees = new Map<string, { kind: string; name: string }>()
  validAttendees.set('primary', { kind: 'primary', name: guest.name })
  if (guest.plusOne) {
    validAttendees.set('plus-one', { kind: 'plus_one', name: guest.plusOneName?.trim() || 'Plus One' })
  }
  if (guest.kidsAttending && (guest.kidsCount ?? 0) > 0) {
    for (let i = 1; i <= (guest.kidsCount ?? 0); i++) {
      validAttendees.set(`child-${i}`, { kind: 'child', name: `Child ${i}` })
    }
  }

  for (const key of input.attendeeKeys) {
    if (!validAttendees.has(key)) {
      throw new Error(`INVALID_ATTENDEE_KEY: ${key}`)
    }
  }

  const source = input.source ?? 'qr'
  const checkIns: Array<{
    id: string
    attendeeKey: string
    attendeeKind: string
    attendeeName: string
    admittedAt: string
  }> = []

  for (const attendeeKey of input.attendeeKeys) {
    const attendee = validAttendees.get(attendeeKey)!
    const checkInId = randomUUID()
    const rows = await db.$queryRawUnsafe<Array<{
      id: string
      attendeeKey: string
      attendeeKind: string
      attendeeName: string
      admittedAt: Date
    }>>(
      `INSERT INTO public."WeddingCheckIn"
        (id, "weddingId", "guestId", "credentialId", "gateId", "admittedByUserId",
         "eventKey", "attendeeKey", "attendeeKind", "attendeeName", source,
         "deviceId", "clientEventId", "admittedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now(), now())
       ON CONFLICT ("weddingId", "eventKey", "guestId", "attendeeKey")
       DO UPDATE SET "updatedAt" = now()
       RETURNING id, "attendeeKey", "attendeeKind", "attendeeName", "admittedAt"`,
      checkInId,
      input.weddingId,
      credential.guestId,
      credential.id,
      input.gateId,
      input.operatorUserId,
      WEDDING_DAY_EVENT_KEY,
      attendeeKey,
      attendee.kind,
      attendee.name,
      source,
      input.deviceId ?? null,
      input.clientEventId ?? null,
    )
    const row = rows[0]
    checkIns.push({
      id: row.id,
      attendeeKey: row.attendeeKey,
      attendeeKind: row.attendeeKind,
      attendeeName: row.attendeeName,
      admittedAt: row.admittedAt.toISOString(),
    })
  }

  return {
    success: true,
    admittedCount: checkIns.length,
    guestId: credential.guestId,
    attendeeKeys: input.attendeeKeys,
    checkIns,
  }
}
