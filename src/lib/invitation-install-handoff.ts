import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import type { InvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  buildPlayStoreInstallUrl,
  isValidInvitationHandoffSecret,
} from '@/lib/invitation-links'

const DEFAULT_HANDOFF_TTL_SECONDS = 24 * 60 * 60
const MIN_HANDOFF_TTL_SECONDS = 5 * 60
const MAX_HANDOFF_TTL_SECONDS = 48 * 60 * 60
const CREATION_WINDOW_MS = 10 * 60 * 1000
const MAX_CREATIONS_PER_WINDOW = 5
const RESUME_FAILURE_WINDOW_MS = 10 * 60 * 1000
const MAX_RESUME_FAILURES_PER_WINDOW = 20

export type InvitationHandoffFailure =
  | 'invalid'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'rate_limited'

export interface CreatedInvitationInstallHandoff {
  id: string
  playStoreUrl: string
  expiresAt: Date
}

export type ConsumedInvitationInstallHandoff =
  | {
      ok: true
      handoffId: string
      weddingId: string
      weddingSlug: string
      guestId: string
      rsvpToken: string
      card: InvitationCardStyle
    }
  | {
      ok: false
      reason: InvitationHandoffFailure
    }

interface HandoffRow {
  id: string
  tokenHash: string
  rsvpId: string
  rsvpTokenHash: string
  weddingId: string
  guestId: string
  card: string
  source: string
  createdAt: Date
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
}

export class InvitationHandoffRateLimitError extends Error {
  constructor() {
    super('Invitation install handoff rate limit exceeded')
    this.name = 'InvitationHandoffRateLimitError'
  }
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function configuredTtlSeconds(): number {
  const configured = Number.parseInt(
    process.env.WEWED_INVITATION_HANDOFF_TTL_SECONDS ?? '',
    10,
  )
  if (!Number.isFinite(configured)) return DEFAULT_HANDOFF_TTL_SECONDS
  return Math.min(
    MAX_HANDOFF_TTL_SECONDS,
    Math.max(MIN_HANDOFF_TTL_SECONDS, configured),
  )
}

function normalizeCard(value: string): InvitationCardStyle {
  if (value === 'editorial' || value === 'midnight') return value
  return 'botanical'
}

async function writeAudit(input: {
  action: string
  resourceId?: string | null
  weddingId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  details?: Record<string, string | number | boolean | null>
}): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        action: input.action,
        resourceType: 'InvitationInstallHandoff',
        resourceId: input.resourceId ?? null,
        weddingId: input.weddingId ?? null,
        ipAddress: input.ipAddress?.slice(0, 128) || null,
        userAgent: input.userAgent?.slice(0, 512) || null,
        afterValue: input.details ? JSON.stringify(input.details) : null,
      },
    })
  } catch (error) {
    console.warn('[wewed] Invitation handoff audit write failed', {
      action: input.action,
      resourceId: input.resourceId ?? null,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}

async function enforceCreationRateLimit(rsvpId: string): Promise<void> {
  const since = new Date(Date.now() - CREATION_WINDOW_MS)
  const rows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM private."InvitationInstallHandoff"
    WHERE "rsvpId" = ${rsvpId}
      AND "createdAt" >= ${since}
  `
  if (Number(rows[0]?.count ?? 0) >= MAX_CREATIONS_PER_WINDOW) {
    throw new InvitationHandoffRateLimitError()
  }
}

async function isResumeRateLimited(ipAddress?: string | null): Promise<boolean> {
  if (!ipAddress) return false
  const failures = await db.auditEvent.count({
    where: {
      resourceType: 'InvitationInstallHandoff',
      ipAddress: ipAddress.slice(0, 128),
      createdAt: { gte: new Date(Date.now() - RESUME_FAILURE_WINDOW_MS) },
      action: {
        in: [
          'invitation_handoff_invalid',
          'invitation_handoff_expired',
          'invitation_handoff_reused',
          'invitation_handoff_revoked',
        ],
      },
    },
  })
  return failures >= MAX_RESUME_FAILURES_PER_WINDOW
}

export async function createInvitationInstallHandoff(input: {
  weddingId: string
  guestId: string
  rsvpToken: string
  card: InvitationCardStyle
  source?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<CreatedInvitationInstallHandoff> {
  const rsvp = await db.rSVP.findUnique({
    where: { token: input.rsvpToken },
    select: { id: true, guestId: true },
  })

  if (!rsvp || rsvp.guestId !== input.guestId) {
    throw new Error('Invitation is no longer available')
  }

  await enforceCreationRateLimit(rsvp.id)

  const id = randomUUID()
  const secret = randomBytes(32).toString('base64url')
  const tokenHash = hashSecret(secret)
  const rsvpTokenHash = hashSecret(input.rsvpToken)
  const expiresAt = new Date(Date.now() + configuredTtlSeconds() * 1000)
  const source = (input.source?.trim() || 'install-cta').slice(0, 64)

  await db.$executeRaw`
    INSERT INTO private."InvitationInstallHandoff" (
      "id", "tokenHash", "rsvpId", "rsvpTokenHash", "weddingId", "guestId",
      "card", "source", "ipAddress", "userAgent", "expiresAt"
    ) VALUES (
      ${id}, ${tokenHash}, ${rsvp.id}, ${rsvpTokenHash}, ${input.weddingId},
      ${input.guestId}, ${input.card}, ${source},
      ${input.ipAddress?.slice(0, 128) || null},
      ${input.userAgent?.slice(0, 512) || null}, ${expiresAt}
    )
  `

  await writeAudit({
    action: 'invitation_handoff_created',
    resourceId: id,
    weddingId: input.weddingId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    details: { source, expiresAt: expiresAt.toISOString() },
  })

  return {
    id,
    playStoreUrl: buildPlayStoreInstallUrl(secret),
    expiresAt,
  }
}

async function failedResult(
  reason: InvitationHandoffFailure,
  input: {
    action: string
    handoffId?: string | null
    weddingId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
  },
): Promise<ConsumedInvitationInstallHandoff> {
  await writeAudit({
    action: input.action,
    resourceId: input.handoffId,
    weddingId: input.weddingId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    details: { reason },
  })
  return { ok: false, reason }
}

export async function consumeInvitationInstallHandoff(input: {
  secret: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<ConsumedInvitationInstallHandoff> {
  if (await isResumeRateLimited(input.ipAddress)) {
    return { ok: false, reason: 'rate_limited' }
  }

  if (!isValidInvitationHandoffSecret(input.secret)) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return failedResult('invalid', {
      action: 'invitation_handoff_invalid',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
  }

  const tokenHash = hashSecret(input.secret)
  const rows = await db.$queryRaw<HandoffRow[]>`
    SELECT
      "id", "tokenHash", "rsvpId", "rsvpTokenHash", "weddingId", "guestId",
      "card", "source", "createdAt", "expiresAt", "usedAt", "revokedAt"
    FROM private."InvitationInstallHandoff"
    WHERE "tokenHash" = ${tokenHash}
    LIMIT 1
  `
  const handoff = rows[0]

  if (!handoff) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return failedResult('invalid', {
      action: 'invitation_handoff_invalid',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
  }

  if (handoff.usedAt) {
    return failedResult('used', {
      action: 'invitation_handoff_reused',
      handoffId: handoff.id,
      weddingId: handoff.weddingId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
  }

  if (handoff.revokedAt) {
    return failedResult('revoked', {
      action: 'invitation_handoff_revoked',
      handoffId: handoff.id,
      weddingId: handoff.weddingId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
  }

  if (handoff.expiresAt.getTime() <= Date.now()) {
    return failedResult('expired', {
      action: 'invitation_handoff_expired',
      handoffId: handoff.id,
      weddingId: handoff.weddingId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
  }

  const rsvp = await db.rSVP.findUnique({
    where: { id: handoff.rsvpId },
    include: {
      guest: {
        include: {
          wedding: {
            select: { id: true, slug: true, privacy: true },
          },
        },
      },
    },
  })

  const invitationStillValid =
    rsvp &&
    rsvp.guestId === handoff.guestId &&
    rsvp.guest.wedding.id === handoff.weddingId &&
    rsvp.guest.wedding.privacy !== 'private' &&
    hashSecret(rsvp.token) === handoff.rsvpTokenHash

  if (!invitationStillValid || !rsvp) {
    await db.$executeRaw`
      UPDATE private."InvitationInstallHandoff"
      SET "revokedAt" = COALESCE("revokedAt", NOW())
      WHERE "id" = ${handoff.id}
    `
    return failedResult('revoked', {
      action: 'invitation_handoff_revoked',
      handoffId: handoff.id,
      weddingId: handoff.weddingId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
  }

  const consumed = await db.$executeRaw`
    UPDATE private."InvitationInstallHandoff"
    SET "usedAt" = NOW()
    WHERE "id" = ${handoff.id}
      AND "usedAt" IS NULL
      AND "revokedAt" IS NULL
      AND "expiresAt" > NOW()
  `

  if (Number(consumed) !== 1) {
    return failedResult('used', {
      action: 'invitation_handoff_reused',
      handoffId: handoff.id,
      weddingId: handoff.weddingId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
  }

  await writeAudit({
    action: 'invitation_handoff_redeemed',
    resourceId: handoff.id,
    weddingId: handoff.weddingId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    details: { source: handoff.source },
  })

  return {
    ok: true,
    handoffId: handoff.id,
    weddingId: handoff.weddingId,
    weddingSlug: rsvp.guest.wedding.slug,
    guestId: handoff.guestId,
    rsvpToken: rsvp.token,
    card: normalizeCard(handoff.card),
  }
}
