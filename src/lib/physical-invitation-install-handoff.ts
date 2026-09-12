import 'server-only'

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { db } from '@/lib/db'
import {
  normalizeInvitationCardStyle,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'
import {
  buildPhysicalInvitationResumePath,
  buildPhysicalPlayStoreInstallUrl,
  isValidPhysicalInvitationHandoff,
} from '@/lib/invitation-links'

const HANDOFF_TTL_SECONDS = 24 * 60 * 60
const TOKEN_PREFIX = 'p1.'
const IV_BYTES = 12
const TAG_BYTES = 16

interface PhysicalInvitationHandoffPayload {
  version: 1
  weddingId: string
  destinationId: string
  card: InvitationCardStyle
  expiresAt: number
}

function encryptionKey(): Buffer {
  const secret =
    process.env.WEWED_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secret) {
    throw new Error('[wewed] Missing invitation handoff encryption secret.')
  }
  return createHash('sha256')
    .update(`wewed:physical-invitation-install:v1\0${secret}`, 'utf8')
    .digest()
}

function encrypt(payload: PhysicalInvitationHandoffPayload): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${TOKEN_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64url')}`
}

function decrypt(token: string): PhysicalInvitationHandoffPayload | null {
  if (!isValidPhysicalInvitationHandoff(token)) return null
  try {
    const packed = Buffer.from(token.slice(TOKEN_PREFIX.length), 'base64url')
    if (packed.length <= IV_BYTES + TAG_BYTES) return null
    const iv = packed.subarray(0, IV_BYTES)
    const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
    const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES)
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')
    const payload = JSON.parse(plaintext) as Partial<PhysicalInvitationHandoffPayload>
    if (
      payload.version !== 1 ||
      typeof payload.weddingId !== 'string' ||
      typeof payload.destinationId !== 'string' ||
      typeof payload.card !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }
    return {
      version: 1,
      weddingId: payload.weddingId,
      destinationId: payload.destinationId,
      card: normalizeInvitationCardStyle(payload.card),
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

export async function createPhysicalInvitationInstallHandoff(input: {
  destinationId: string
  weddingId: string
  card: InvitationCardStyle
}) {
  const expiresAt = Date.now() + HANDOFF_TTL_SECONDS * 1000
  const token = encrypt({
    version: 1,
    weddingId: input.weddingId,
    destinationId: input.destinationId,
    card: input.card,
    expiresAt,
  })

  return {
    playStoreUrl: buildPhysicalPlayStoreInstallUrl(token),
    appResumePath: buildPhysicalInvitationResumePath(token),
    expiresAt: new Date(expiresAt),
  }
}

export async function consumePhysicalInvitationInstallHandoff(token: string) {
  const handoff = decrypt(token)
  if (!handoff) return { ok: false as const, reason: 'invalid' as const }

  const destination = await db.qRDestination.findFirst({
    where: {
      id: handoff.destinationId,
      weddingId: handoff.weddingId,
      type: 'physical_invitation',
      isActive: true,
    },
    select: {
      id: true,
      weddingId: true,
      wedding: {
        select: {
          slug: true,
          privacy: true,
          invitationCardStyle: true,
        },
      },
    },
  })

  if (!destination || destination.wedding.privacy === 'private') {
    return { ok: false as const, reason: 'revoked' as const }
  }

  return {
    ok: true as const,
    weddingId: handoff.weddingId,
    weddingSlug: destination.wedding.slug,
    destinationId: handoff.destinationId,
    card: normalizeInvitationCardStyle(handoff.card),
  }
}
