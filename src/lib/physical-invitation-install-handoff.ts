import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle, type InvitationCardStyle } from '@/lib/digital-invitation-card'
import { buildPhysicalInvitationResumePath, buildPhysicalPlayStoreInstallUrl, isValidInvitationHandoffSecret } from '@/lib/invitation-links'
import { previewWeddingMutationBlocked } from '@/lib/preview-write-safety'

const HANDOFF_TTL_SECONDS = 24 * 60 * 60
const CREATION_WINDOW_MS = 10 * 60 * 1000
const MAX_CREATIONS_PER_WINDOW = 5

interface PhysicalHandoffRow {
  id: string
  tokenHash: string
  destinationId: string
  weddingId: string
  card: string
  source: string
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
}

export class PhysicalInvitationHandoffRateLimitError extends Error {
  constructor() {
    super('Physical invitation install handoff rate limit exceeded')
    this.name = 'PhysicalInvitationHandoffRateLimitError'
  }
}

function hash(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

async function enforceRateLimit(destinationId: string) {
  const since = new Date(Date.now() - CREATION_WINDOW_MS)
  const rows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM private."PhysicalInvitationInstallHandoff"
    WHERE "destinationId" = ${destinationId}
      AND "createdAt" >= ${since}
  `
  if (Number(rows[0]?.count ?? 0) >= MAX_CREATIONS_PER_WINDOW) {
    throw new PhysicalInvitationHandoffRateLimitError()
  }
}

export async function createPhysicalInvitationInstallHandoff(input: {
  destinationId: string
  weddingId: string
  card: InvitationCardStyle
  source?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}) {
  if (previewWeddingMutationBlocked(input.weddingId)) throw new Error('PREVIEW_WRITE_BLOCKED')
  await enforceRateLimit(input.destinationId)

  const id = randomUUID()
  const secret = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000)
  const source = (input.source?.trim() || 'physical-android-install').slice(0, 64)

  await db.$executeRaw`
    INSERT INTO private."PhysicalInvitationInstallHandoff" (
      "id", "tokenHash", "destinationId", "weddingId", "card", "source",
      "ipAddress", "userAgent", "expiresAt"
    ) VALUES (
      ${id}, ${hash(secret)}, ${input.destinationId}, ${input.weddingId}, ${input.card}, ${source},
      ${input.ipAddress?.slice(0, 128) || null}, ${input.userAgent?.slice(0, 512) || null}, ${expiresAt}
    )
  `

  return {
    id,
    playStoreUrl: buildPhysicalPlayStoreInstallUrl(secret),
    appResumePath: buildPhysicalInvitationResumePath(secret),
    expiresAt,
  }
}

export async function consumePhysicalInvitationInstallHandoff(secret: string) {
  if (!isValidInvitationHandoffSecret(secret)) return { ok: false as const, reason: 'invalid' as const }

  const rows = await db.$queryRaw<PhysicalHandoffRow[]>`
    SELECT "id", "tokenHash", "destinationId", "weddingId", "card", "source", "expiresAt", "usedAt", "revokedAt"
    FROM private."PhysicalInvitationInstallHandoff"
    WHERE "tokenHash" = ${hash(secret)}
    LIMIT 1
  `
  const handoff = rows[0]
  if (!handoff) return { ok: false as const, reason: 'invalid' as const }
  if (handoff.usedAt) return { ok: false as const, reason: 'used' as const }
  if (handoff.revokedAt) return { ok: false as const, reason: 'revoked' as const }
  if (handoff.expiresAt.getTime() <= Date.now()) return { ok: false as const, reason: 'expired' as const }
  if (previewWeddingMutationBlocked(handoff.weddingId)) return { ok: false as const, reason: 'invalid' as const }

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
      wedding: { select: { slug: true, privacy: true, invitationCardStyle: true } },
    },
  })

  if (!destination || destination.wedding.privacy === 'private') {
    await db.$executeRaw`
      UPDATE private."PhysicalInvitationInstallHandoff"
      SET "revokedAt" = COALESCE("revokedAt", NOW())
      WHERE "id" = ${handoff.id}
    `
    return { ok: false as const, reason: 'revoked' as const }
  }

  const consumed = await db.$executeRaw`
    UPDATE private."PhysicalInvitationInstallHandoff"
    SET "usedAt" = NOW()
    WHERE "id" = ${handoff.id}
      AND "usedAt" IS NULL
      AND "revokedAt" IS NULL
      AND "expiresAt" > NOW()
  `
  if (Number(consumed) !== 1) return { ok: false as const, reason: 'used' as const }

  return {
    ok: true as const,
    weddingId: handoff.weddingId,
    weddingSlug: destination.wedding.slug,
    destinationId: handoff.destinationId,
    card: normalizeInvitationCardStyle(handoff.card),
  }
}
