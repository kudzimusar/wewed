import 'server-only'

import { createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from 'node:crypto'
import { db } from '@/lib/db'
import { isWeddingDayWW2Enabled } from '@/lib/wedding-day-feature'
import {
  WW2_ALGORITHM,
  WW2_VERSION,
  WEDDING_DAY_EVENT_KEY,
  weddingShortId,
} from '@/lib/wedding-day'

interface ManifestKeyRow {
  keyId: string
  publicKeyDerBase64: string
  status: string
  activeFrom: Date
  expiresAt: Date | null
  revokedAt: Date | null
}

interface ManifestCredentialRow {
  guestId: string
  guestName: string
  tableNumber: number | null
  passSerial: string
  nonce: string
  eventBitmask: number
  issuedAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  keyId: string
  attending: boolean | null
  plusOne: boolean
  plusOneName: string | null
  kidsAttending: boolean
  kidsCount: number
}

interface ManifestCheckInRow {
  guestId: string
  attendeeKey: string
}

interface HouseholdMember {
  attendeeKey: string
  attendeeKind: 'primary' | 'plus_one' | 'child'
  attendeeName: string
}

function normalizePem(value: string | undefined, envName: string): string {
  const normalized = value?.trim().replace(/\\n/g, '\n')
  if (!normalized) {
    throw new Error(`[wewed:wedding-day] Missing ${envName}.`)
  }
  return normalized
}

function signRootPayload(payload: string): string {
  const privateKeyPem = normalizePem(
    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM,
    'WEDDING_DAY_ROOT_PRIVATE_KEY_PEM',
  )
  const privateKey = createPrivateKey(privateKeyPem)
  return cryptoSign('sha256', Buffer.from(payload, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('hex')
}

function householdMembers(row: ManifestCredentialRow): HouseholdMember[] {
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

/**
 * Builds the field-operations manifest consumed by native gate clients.
 *
 * The payload carries only admission data needed at the gate:
 * public signing keys, pass-to-guest mapping, exact household attendee keys,
 * current admission state, and revocation/expiry metadata.
 * It never contains a signing private key or a reusable application session token.
 */
export async function signedNativeWeddingDayManifest(weddingId: string) {
  if (!isWeddingDayWW2Enabled()) {
    throw new Error('WEDDING_DAY_DISABLED')
  }

  const rootKeyId = process.env.WEDDING_DAY_ROOT_KEY_ID?.trim()
  if (!rootKeyId) {
    throw new Error('[wewed:wedding-day] Missing WEDDING_DAY_ROOT_KEY_ID.')
  }

  const weddings = await db.$queryRawUnsafe<Array<{ id: string; slug: string }>>(
    `SELECT id, slug FROM public."Wedding" WHERE id = $1 LIMIT 1`,
    weddingId,
  )
  const wedding = weddings[0]
  if (!wedding) throw new Error('WEDDING_NOT_FOUND')

  const [keys, credentials, checkIns] = await Promise.all([
    db.$queryRawUnsafe<ManifestKeyRow[]>(
      `SELECT "keyId", "publicKeyDerBase64", status, "activeFrom", "expiresAt", "revokedAt"
         FROM public."WeddingPassKey"
        WHERE "weddingId" = $1
        ORDER BY "activeFrom" DESC, "keyId" ASC`,
      weddingId,
    ),
    db.$queryRawUnsafe<ManifestCredentialRow[]>(
      `SELECT c."guestId",
              g.name AS "guestName",
              g."tableNumber",
              c."passSerial",
              c.nonce,
              c."eventBitmask",
              c."issuedAt",
              c."expiresAt",
              COALESCE(c."revokedAt", c."supersededAt") AS "revokedAt",
              pk."keyId",
              r.attending,
              COALESCE(r."plusOne", FALSE) AS "plusOne",
              r."plusOneName",
              COALESCE(r."kidsAttending", FALSE) AS "kidsAttending",
              COALESCE(r."kidsCount", 0) AS "kidsCount"
         FROM public."WeddingPassCredential" c
         JOIN public."WeddingPassKey" pk
           ON pk.id = c."passKeyId" AND pk."weddingId" = c."weddingId"
         JOIN public."Guest" g
           ON g.id = c."guestId" AND g."weddingId" = c."weddingId"
         LEFT JOIN public."RSVP" r ON r."guestId" = g.id
        WHERE c."weddingId" = $1
        ORDER BY c."issuedAt" ASC, c."passSerial" ASC`,
      weddingId,
    ),
    db.$queryRawUnsafe<ManifestCheckInRow[]>(
      `SELECT "guestId", "attendeeKey"
         FROM public."WeddingCheckIn"
        WHERE "weddingId" = $1 AND "eventKey" = $2
        ORDER BY "guestId" ASC, "attendeeKey" ASC`,
      weddingId,
      WEDDING_DAY_EVENT_KEY,
    ),
  ])

  const checkedInByGuest = new Map<string, string[]>()
  for (const record of checkIns) {
    const values = checkedInByGuest.get(record.guestId) ?? []
    values.push(record.attendeeKey)
    checkedInByGuest.set(record.guestId, values)
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  const payload = {
    manifestVersion: 2,
    tokenVersion: WW2_VERSION,
    weddingId,
    weddingSlug: wedding.slug,
    weddingShortId: weddingShortId(weddingId),
    eventKey: WEDDING_DAY_EVENT_KEY,
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
    credentials: credentials.map((credential) => {
      const household = householdMembers(credential)
      return {
        guestId: credential.guestId,
        guestName: credential.guestName,
        tableNumber: credential.tableNumber,
        passSerial: credential.passSerial,
        nonce: credential.nonce,
        eventBitmask: credential.eventBitmask,
        keyId: credential.keyId,
        eligible: credential.attending === true,
        household,
        partySize: household.length,
        checkedInAttendeeKeys: checkedInByGuest.get(credential.guestId) ?? [],
        issuedAt: credential.issuedAt.toISOString(),
        expiresAt: credential.expiresAt?.toISOString() ?? null,
        revokedAt: credential.revokedAt?.toISOString() ?? null,
      }
    }),
  }

  const canonicalPayload = JSON.stringify(payload)
  return {
    rootKeyId,
    algorithm: WW2_ALGORITHM,
    payload,
    canonicalPayload,
    signatureHex: signRootPayload(canonicalPayload),
  }
}

export function verifySignedWeddingDayManifest(input: {
  canonicalPayload: string
  signatureHex: string
  rootPublicKeyDerBase64: string
}): boolean {
  try {
    const der = Buffer.from(input.rootPublicKeyDerBase64, 'base64')
    const key = createPublicKey({ key: der, format: 'der', type: 'spki' })
    const sig = Buffer.from(input.signatureHex, 'hex')
    return cryptoVerify(
      'sha256',
      Buffer.from(input.canonicalPayload, 'utf8'),
      {
        key,
        dsaEncoding: 'ieee-p1363',
      },
      sig,
    )
  } catch {
    return false
  }
}
