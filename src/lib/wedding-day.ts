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
import {
  assertWeddingDayWW2RuntimeReady,
  isWeddingDayWW2Enabled,
} from '@/lib/wedding-day-feature'
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
  algorithm: string
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
  // Keep the established cross-platform WW2 wire contract. Android/iOS TokenVerifier parse
  // exactly six dot-delimited fields: version, wedding, serial, mask, nonce, signature.
  return `${WW2_VERSION}.${input.weddingShortId}.${input.passSerial}.${mask}.${input.nonce}`
}

export function parseWw2Token(token: string): ParsedWw2Token | null {
  const parts = token.trim().split('.')
  if (parts.length !== 6 || parts[0] !== WW2_VERSION) return null

  const eventBitmask = Number.parseInt(parts[3], 16)
  if (
    !/^[0-9a-f]{2}$/i.test(parts[3]) ||
    !Number.isInteger(eventBitmask) ||
    eventBitmask < 0 ||
    eventBitmask > 0xff
  ) {
    return null
  }
  if (
    !parts[1] ||
    !parts[2] ||
    !parts[4] ||
    !/^[0-9a-f]{128}$/i.test(parts[5])
  ) {
    return null
  }

  const payload = canonicalWw2Payload({
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

function ww2KeyMaterial(): {
  privateKeyPem: string
  keyId: string
  publicKeyPem: string
  publicKeyDerBase64: string
} {
  const privateKeyPem = process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM?.trim().replace(/\\n/g, '\n')
  const keyId = process.env.WEDDING_DAY_WW2_KEY_ID?.trim()
  if (!privateKeyPem || !keyId) {
    throw new Error('WEDDING_DAY_WW2_KEY_UNAVAILABLE')
  }

  let privateKey
  try {
    privateKey = createPrivateKey(privateKeyPem)
  } catch {
    throw new Error('WEDDING_DAY_WW2_KEY_INVALID')
  }
  const curve = (privateKey.asymmetricKeyDetails as { namedCurve?: string } | undefined)?.namedCurve
  if (
    privateKey.asymmetricKeyType !== 'ec' ||
    (curve !== 'prime256v1' && curve !== 'P-256')
  ) {
    throw new Error('WEDDING_DAY_WW2_KEY_INVALID')
  }

  const publicKey = createPublicKey(privateKey)
  return {
    privateKeyPem,
    keyId,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    publicKeyDerBase64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  }
}

function assertPassKeyUsable(passKey: PassKeyRow, now: Date = new Date()): void {
  if (
    passKey.algorithm !== WW2_ALGORITHM ||
    passKey.status !== 'active' ||
    passKey.revokedAt ||
    passKey.activeFrom.getTime() > now.getTime() ||
    (passKey.expiresAt && passKey.expiresAt.getTime() <= now.getTime())
  ) {
    throw new Error('PASS_SIGNING_KEY_INACTIVE')
  }
}

async function passKeyForCredential(
  queryable: Pick<typeof db, '$queryRawUnsafe'>,
  credential: CredentialRow,
  now: Date = new Date(),
): Promise<PassKeyRow> {
  const rows = await queryable.$queryRawUnsafe<PassKeyRow[]>(
    `SELECT * FROM public."WeddingPassKey"
      WHERE id = $1 AND "weddingId" = $2
      LIMIT 1`,
    credential.passKeyId,
    credential.weddingId,
  )
  const passKey = rows[0]
  if (!passKey) throw new Error('PASS_SIGNING_KEY_INACTIVE')
  assertPassKeyUsable(passKey, now)
  return passKey
}

export async function ensurePassKey(weddingId: string): Promise<PassKeyRow> {
  assertWeddingDayWW2RuntimeReady()
  const material = ww2KeyMaterial()
  const validateBoundKey = (key: PassKeyRow): PassKeyRow => {
    if (
      key.algorithm !== WW2_ALGORITHM ||
      key.publicKeyDerBase64 !== material.publicKeyDerBase64
    ) {
      // keyId is an immutable identity. Reusing it for different key material would silently
      // invalidate previously issued credentials and is therefore forbidden.
      throw new Error('WEDDING_DAY_WW2_KEY_ID_MATERIAL_MISMATCH')
    }
    assertPassKeyUsable(key)
    return key
  }

  const existing = await db.$queryRawUnsafe<PassKeyRow[]>(
    `SELECT * FROM public."WeddingPassKey"
      WHERE "weddingId" = $1 AND "keyId" = $2
      LIMIT 1`,
    weddingId,
    material.keyId,
  )
  if (existing[0]) return validateBoundKey(existing[0])

  const id = randomUUID()
  const inserted = await db.$queryRawUnsafe<PassKeyRow[]>(
    `INSERT INTO public."WeddingPassKey"
       (id, "weddingId", "keyId", algorithm, "publicKeyPem", "publicKeyDerBase64", status, "activeFrom", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, 'active', now(), now(), now())
     ON CONFLICT ("weddingId", "keyId") DO NOTHING
     RETURNING *`,
    id,
    weddingId,
    material.keyId,
    WW2_ALGORITHM,
    material.publicKeyPem,
    material.publicKeyDerBase64,
  )
  if (inserted[0]) return validateBoundKey(inserted[0])

  // A concurrent creator won the key-id race. Read it back and require exact material identity.
  const winner = await db.$queryRawUnsafe<PassKeyRow[]>(
    `SELECT * FROM public."WeddingPassKey"
      WHERE "weddingId" = $1 AND "keyId" = $2
      LIMIT 1`,
    weddingId,
    material.keyId,
  )
  if (!winner[0]) throw new Error('WEDDING_DAY_WW2_KEY_UNAVAILABLE')
  return validateBoundKey(winner[0])
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
  assertWeddingDayWW2RuntimeReady()

  const now = input.now ?? new Date()

  const issue = async (): Promise<CredentialRow> =>
    db.$transaction(async (tx) => {
      // The Guest row is the serialization point for credential issuance/reissue. Locking a
      // possibly-absent credential row is insufficient because two first issuers can both see zero
      // rows. We also lock the RSVP row so attendance cannot flip between eligibility and insert.
      const guestRows = await tx.$queryRawUnsafe<Array<{ id: string; weddingDate: Date }>>(
        `SELECT g.id, w.date AS "weddingDate"
           FROM public."Guest" g
           JOIN public."Wedding" w ON w.id = g."weddingId"
          WHERE g.id = $1 AND g."weddingId" = $2
          LIMIT 1
          FOR UPDATE OF g, w`,
        input.guestId,
        input.weddingId,
      )
      const guest = guestRows[0]
      if (!guest) {
        throw new Error('GUEST_NOT_FOUND')
      }

      const rsvpRows = await tx.$queryRawUnsafe<Array<{ attending: boolean | null }>>(
        `SELECT attending
           FROM public."RSVP"
          WHERE "guestId" = $1
          LIMIT 1
          FOR UPDATE`,
        input.guestId,
      )
      if (rsvpRows[0]?.attending !== true) {
        throw new Error('ATTENDANCE_REQUIRED')
      }

      const existing = await liveCredential(tx, input.weddingId, input.guestId, true)
      if (existing && credentialIsUsable(existing, now.getTime())) return existing

      if (!weddingPassIssuanceAllowedAt(guest.weddingDate, now)) {
        throw new Error('PASS_ISSUANCE_CLOSED')
      }
      const window = weddingPassIssuanceWindow(guest.weddingDate)

      if (existing) {
        await tx.$queryRawUnsafe(
          `UPDATE public."WeddingPassCredential"
              SET "supersededAt" = COALESCE("supersededAt", $1), "updatedAt" = $1
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
      if (
        passKey.keyId !== material.keyId ||
        passKey.publicKeyDerBase64 !== material.publicKeyDerBase64
      ) {
        throw new Error('WEDDING_DAY_WW2_KEY_ID_MATERIAL_MISMATCH')
      }

      const shortId = weddingShortId(input.weddingId)
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
    if (winner && credentialIsUsable(winner, now.getTime())) return winner
    throw error
  }
}

export async function revokeWeddingPassCredential(input: {
  weddingId: string
  credentialId: string
  reason: string
  now?: Date
}): Promise<CredentialRow> {
  assertWeddingDayWW2RuntimeReady()
  const reason = input.reason.trim()
  if (!reason) throw new Error('REVOCATION_REASON_REQUIRED')
  const now = input.now ?? new Date()

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<CredentialRow[]>(
      `SELECT *
         FROM public."WeddingPassCredential"
        WHERE id = $1 AND "weddingId" = $2
        LIMIT 1
        FOR UPDATE`,
      input.credentialId,
      input.weddingId,
    )
    const credential = rows[0]
    if (!credential) throw new Error('PASS_NOT_FOUND')
    if (credential.revokedAt) return credential

    const updated = await tx.$queryRawUnsafe<CredentialRow[]>(
      `UPDATE public."WeddingPassCredential"
          SET "revokedAt" = $1,
              "revocationReason" = $2,
              "supersededAt" = COALESCE("supersededAt", $1),
              "updatedAt" = $1
        WHERE id = $3 AND "weddingId" = $4
        RETURNING *`,
      now,
      reason,
      credential.id,
      input.weddingId,
    )
    return updated[0]
  })
}

export async function verifyWeddingPassToken(input: {
  weddingId: string
  token: string
  requiredEventBit?: number
}): Promise<CredentialRow> {
  assertWeddingDayWW2RuntimeReady()

  const parsed = parseWw2Token(input.token)
  if (!parsed) throw new Error('INVALID_PASS_TOKEN')

  const shortId = weddingShortId(input.weddingId)
  if (parsed.weddingShortId !== shortId) throw new Error('PASS_WEDDING_MISMATCH')

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
  if (!credential) throw new Error('PASS_NOT_FOUND')

  if (
    credential.revokedAt ||
    credential.supersededAt ||
    (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())
  ) {
    throw new Error('PASS_REVOKED_OR_EXPIRED')
  }

  // A valid signing key cannot be used to fabricate a different payload for an existing serial.
  // The immutable credential row is the canonical signed token issued to this Guest.
  if (
    credential.token !== input.token ||
    credential.nonce !== parsed.nonce ||
    credential.eventBitmask !== parsed.eventBitmask ||
    credential.signatureHex !== parsed.signatureHex
  ) {
    throw new Error('PASS_CREDENTIAL_MISMATCH')
  }

  const passKey = await passKeyForCredential(db, credential)
  const verified = p1363HexVerify(parsed.payload, parsed.signatureHex, passKey.publicKeyPem)
  if (!verified) throw new Error('PASS_SIGNATURE_INVALID')

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
  if (!context) return null
  if (context.attending !== true) {
    throw new Error('ATTENDANCE_REQUIRED')
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
  source?: 'qr' | 'offline-sync'
  deviceId?: string
  clientEventId?: string
}): Promise<WeddingCheckInResult> {
  assertWeddingDayWW2RuntimeReady()

  const requestedKeys = Array.from(new Set(input.attendeeKeys ?? []))
  if (requestedKeys.length === 0) throw new Error('ATTENDEE_KEYS_REQUIRED')

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
    if (!found) throw new Error('PASS_NOT_FOUND')
    if (
      found.revokedAt ||
      found.supersededAt ||
      (found.expiresAt && found.expiresAt.getTime() <= Date.now())
    ) {
      throw new Error('PASS_REVOKED_OR_EXPIRED')
    }
    await passKeyForCredential(db, found)
    credential = found
  } else {
    throw new Error('TOKEN_OR_SERIAL_REQUIRED')
  }

  const source = input.source ?? (input.token ? 'qr' : 'offline-sync')

  return db.$transaction(async (tx) => {
    // Re-lock and revalidate credential/key state so revocation cannot race the admission write.
    const credentialRows = await tx.$queryRawUnsafe<CredentialRow[]>(
      `SELECT *
         FROM public."WeddingPassCredential"
        WHERE id = $1 AND "weddingId" = $2
        LIMIT 1
        FOR UPDATE`,
      credential.id,
      input.weddingId,
    )
    const currentCredential = credentialRows[0]
    if (
      !currentCredential ||
      currentCredential.revokedAt ||
      currentCredential.supersededAt ||
      (currentCredential.expiresAt && currentCredential.expiresAt.getTime() <= Date.now())
    ) {
      throw new Error('PASS_REVOKED_OR_EXPIRED')
    }
    await passKeyForCredential(tx, currentCredential)

    const gateRows = await tx.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `SELECT id, status
         FROM public."WeddingGate"
        WHERE id = $1 AND "weddingId" = $2
        LIMIT 1`,
      input.gateId,
      input.weddingId,
    )
    if (!gateRows[0] || gateRows[0].status !== 'active') {
      throw new Error('GATE_INACTIVE_OR_INVALID')
    }

    const guestRows = await tx.$queryRawUnsafe<Array<{
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
         JOIN public."RSVP" r ON r."guestId" = g.id
        WHERE g.id = $1 AND g."weddingId" = $2
        LIMIT 1
        FOR UPDATE OF g, r`,
      currentCredential.guestId,
      input.weddingId,
    )
    const guest = guestRows[0]
    if (!guest || guest.attending !== true) throw new Error('GUEST_INELIGIBLE')

    const validAttendees = new Map<string, { kind: string; name: string }>()
    validAttendees.set('primary', { kind: 'primary', name: guest.name })
    if (guest.plusOne) {
      validAttendees.set('plus-one', {
        kind: 'plus_one',
        name: guest.plusOneName?.trim() || 'Plus One',
      })
    }
    if (guest.kidsAttending && (guest.kidsCount ?? 0) > 0) {
      for (let index = 1; index <= (guest.kidsCount ?? 0); index += 1) {
        validAttendees.set(`child-${index}`, { kind: 'child', name: `Child ${index}` })
      }
    }

    for (const key of requestedKeys) {
      if (!validAttendees.has(key)) throw new Error(`INVALID_ATTENDEE_KEY: ${key}`)
    }

    const checkIns: WeddingCheckInResult['checkIns'] = []
    for (const attendeeKey of requestedKeys) {
      const attendee = validAttendees.get(attendeeKey)!
      const rows = await tx.$queryRawUnsafe<Array<{
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
        randomUUID(),
        input.weddingId,
        currentCredential.guestId,
        currentCredential.id,
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

    const admittedRows = await tx.$queryRawUnsafe<Array<{ attendeeKey: string }>>(
      `SELECT "attendeeKey"
         FROM public."WeddingCheckIn"
        WHERE "weddingId" = $1
          AND "eventKey" = $2
          AND "guestId" = $3`,
      input.weddingId,
      WEDDING_DAY_EVENT_KEY,
      currentCredential.guestId,
    )
    const admitted = new Set(admittedRows.map((row) => row.attendeeKey))
    const householdComplete = Array.from(validAttendees.keys()).every((key) => admitted.has(key))

    await tx.$queryRawUnsafe(
      `UPDATE public."RSVP"
          SET "checkedIn" = $1,
              "checkedInAt" = CASE
                WHEN $1 THEN COALESCE("checkedInAt", now())
                ELSE NULL
              END,
              "updatedAt" = now()
        WHERE "guestId" = $2`,
      householdComplete,
      currentCredential.guestId,
    )

    return {
      success: true,
      admittedCount: checkIns.length,
      guestId: currentCredential.guestId,
      attendeeKeys: requestedKeys,
      checkIns,
    }
  })
}

