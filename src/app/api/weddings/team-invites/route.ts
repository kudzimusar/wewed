import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  TEAM_INVITE_EXPIRY_HOURS,
  TEAM_INVITE_SECTION,
  canGrantTeamInviteRole,
  createTeamInviteToken,
  hashTeamInviteToken,
  inviteIsExpired,
  isTeamInviteRole,
  parseTeamInviteState,
  teamInvitePermissionSummary,
  teamInviteRoleLabel,
  type TeamInviteState,
} from '@/lib/team-invite'
import { requireWeddingPermission } from '@/lib/wedding-access'

const MAX_INVITES_PER_HOUR = 20
const MAX_PENDING_INVITES = 50

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const result = value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()
  return result ? result.slice(0, maxLength) : null
}

function normalizedEmail(value: unknown): string | null {
  const email = clean(value, 320)?.toLowerCase() ?? null
  if (!email) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function publicBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  return configured || request.nextUrl.origin
}

function serializeInvite(record: { id: string; value: string; createdAt: Date; updatedAt: Date }) {
  const state = parseTeamInviteState(record.value)
  if (!state) return null
  const effectiveStatus = state.status === 'pending' && inviteIsExpired(state) ? 'expired' : state.status
  return {
    id: record.id,
    role: state.role,
    roleLabel: teamInviteRoleLabel(state.role),
    permissionSummary: teamInvitePermissionSummary(state.role),
    status: effectiveStatus,
    note: state.note,
    inviteeEmail: state.inviteeEmail,
    invitedByLabel: state.invitedByLabel,
    createdAt: state.createdAt,
    expiresAt: state.expiresAt,
    acceptedAt: state.acceptedAt,
    acceptedById: state.acceptedById,
    rotatedFromId: state.rotatedFromId,
    rotatedToId: state.rotatedToId,
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function inviterLabel(userId: string, fallback: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  return user?.name?.trim() || user?.email || fallback
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'members.manage')
  if (access.error) return access.error

  try {
    const records = await db.weddingContent.findMany({
      where: { weddingId: access.context.weddingId, section: TEAM_INVITE_SECTION },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, value: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({
      success: true,
      data: records.map(serializeInvite).filter(Boolean),
      security: {
        rawLinksStored: false,
        platformAdminInvitesAllowed: false,
      },
    })
  } catch (error) {
    console.error('[team invites GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load team invitations.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'members.manage')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as {
      role?: unknown
      note?: unknown
      inviteeEmail?: unknown
      expiryHours?: unknown
    }
    if (!isTeamInviteRole(body.role)) {
      return NextResponse.json({ success: false, error: 'Choose a supported wedding/project role.' }, { status: 400 })
    }
    if (!canGrantTeamInviteRole(access.context.role, body.role)) {
      return NextResponse.json(
        { success: false, error: 'Your current wedding role cannot grant that level of access.' },
        { status: 403 },
      )
    }
    const expiryHours = typeof body.expiryHours === 'number' && TEAM_INVITE_EXPIRY_HOURS.includes(body.expiryHours as (typeof TEAM_INVITE_EXPIRY_HOURS)[number])
      ? body.expiryHours
      : 24
    const suppliedEmail = clean(body.inviteeEmail, 320)
    const inviteeEmail = normalizedEmail(body.inviteeEmail)
    if (suppliedEmail && !inviteeEmail) {
      return NextResponse.json({ success: false, error: 'Enter a valid invitee email or leave it blank.' }, { status: 400 })
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentCount = await db.weddingContent.count({
      where: { weddingId: access.context.weddingId, section: TEAM_INVITE_SECTION, createdAt: { gte: oneHourAgo } },
    })
    if (recentCount >= MAX_INVITES_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: 'Invitation creation is temporarily limited for this wedding. Try again later.' },
        { status: 429 },
      )
    }
    const pendingRecords = await db.weddingContent.findMany({
      where: { weddingId: access.context.weddingId, section: TEAM_INVITE_SECTION },
      select: { value: true },
    })
    const activePending = pendingRecords.reduce((count, record) => {
      const state = parseTeamInviteState(record.value)
      return count + (state?.status === 'pending' && !inviteIsExpired(state) ? 1 : 0)
    }, 0)
    if (activePending >= MAX_PENDING_INVITES) {
      return NextResponse.json(
        { success: false, error: 'Revoke or allow existing pending invitations to expire before creating more.' },
        { status: 409 },
      )
    }

    const token = createTeamInviteToken()
    const tokenHash = hashTeamInviteToken(token)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000)
    const label = await inviterLabel(access.context.session.userId, access.context.session.email)
    const state: TeamInviteState = {
      version: 1,
      role: body.role,
      status: 'pending',
      note: clean(body.note, 240),
      inviteeEmail,
      invitedById: access.context.session.userId,
      invitedByLabel: label,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      acceptedAt: null,
      acceptedById: null,
      attemptCount: 0,
      rotatedFromId: null,
      rotatedToId: null,
    }

    const created = await db.$transaction(async (tx) => {
      const invite = await tx.weddingContent.create({
        data: {
          weddingId: access.context.weddingId,
          section: TEAM_INVITE_SECTION,
          field: tokenHash,
          value: JSON.stringify(state),
          order: 0,
          metadata: JSON.stringify({ kind: 'team_access_invite', tokenStorage: 'sha256' }),
        },
        select: { id: true, value: true, createdAt: true, updatedAt: true },
      })
      await tx.auditEvent.create({
        data: {
          action: 'team_invite.created',
          resourceType: 'team_invite',
          resourceId: invite.id,
          afterValue: JSON.stringify({ role: state.role, expiresAt: state.expiresAt, inviteeEmail: state.inviteeEmail }),
          weddingId: access.context.weddingId,
          actorId: access.context.session.userId,
        },
      })
      return invite
    })

    return NextResponse.json({
      success: true,
      data: serializeInvite(created),
      joinUrl: `${publicBaseUrl(request)}/join/${token}`,
      rawLinkShownOnce: true,
    }, { status: 201 })
  } catch (error) {
    console.error('[team invites POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to create this team invitation.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'members.manage')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as { inviteId?: unknown; action?: unknown; expiryHours?: unknown }
    const inviteId = clean(body.inviteId, 120) ?? ''
    const action = body.action === 'revoke' || body.action === 'rotate' ? body.action : null
    if (!inviteId || !action) {
      return NextResponse.json({ success: false, error: 'Choose a valid invitation action.' }, { status: 400 })
    }
    const existing = await db.weddingContent.findFirst({
      where: { id: inviteId, weddingId: access.context.weddingId, section: TEAM_INVITE_SECTION },
      select: { id: true, value: true, createdAt: true, updatedAt: true },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Invitation not found.' }, { status: 404 })
    const state = parseTeamInviteState(existing.value)
    if (!state) return NextResponse.json({ success: false, error: 'Invitation state is invalid.' }, { status: 409 })
    if (state.status === 'accepted') {
      return NextResponse.json({ success: false, error: 'Accepted invitations are already consumed and cannot be rotated or revoked.' }, { status: 409 })
    }

    if (action === 'revoke') {
      const nextState: TeamInviteState = { ...state, status: 'revoked' }
      const updated = await db.$transaction(async (tx) => {
        const invite = await tx.weddingContent.update({
          where: { id: existing.id },
          data: { value: JSON.stringify(nextState) },
          select: { id: true, value: true, createdAt: true, updatedAt: true },
        })
        await tx.auditEvent.create({
          data: {
            action: 'team_invite.revoked', resourceType: 'team_invite', resourceId: invite.id,
            beforeValue: JSON.stringify({ status: state.status }), afterValue: JSON.stringify({ status: 'revoked' }),
            weddingId: access.context.weddingId, actorId: access.context.session.userId,
          },
        })
        return invite
      })
      return NextResponse.json({ success: true, data: serializeInvite(updated) })
    }

    const expiryHours = typeof body.expiryHours === 'number' && TEAM_INVITE_EXPIRY_HOURS.includes(body.expiryHours as (typeof TEAM_INVITE_EXPIRY_HOURS)[number])
      ? body.expiryHours
      : 24
    const token = createTeamInviteToken()
    const tokenHash = hashTeamInviteToken(token)
    const now = new Date()
    const rotatedState: TeamInviteState = {
      ...state,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString(),
      acceptedAt: null,
      acceptedById: null,
      attemptCount: 0,
      rotatedFromId: existing.id,
      rotatedToId: null,
    }
    const result = await db.$transaction(async (tx) => {
      const replacement = await tx.weddingContent.create({
        data: {
          weddingId: access.context.weddingId,
          section: TEAM_INVITE_SECTION,
          field: tokenHash,
          value: JSON.stringify(rotatedState),
          order: 0,
          metadata: JSON.stringify({ kind: 'team_access_invite', tokenStorage: 'sha256' }),
        },
        select: { id: true, value: true, createdAt: true, updatedAt: true },
      })
      rotatedState.rotatedFromId = existing.id
      const oldState: TeamInviteState = { ...state, status: 'revoked', rotatedToId: replacement.id }
      await tx.weddingContent.update({ where: { id: existing.id }, data: { value: JSON.stringify(oldState) } })
      await tx.auditEvent.create({
        data: {
          action: 'team_invite.rotated', resourceType: 'team_invite', resourceId: replacement.id,
          beforeValue: JSON.stringify({ inviteId: existing.id }), afterValue: JSON.stringify({ inviteId: replacement.id, role: replacement && state.role }),
          weddingId: access.context.weddingId, actorId: access.context.session.userId,
        },
      })
      return replacement
    })

    return NextResponse.json({
      success: true,
      data: serializeInvite(result),
      joinUrl: `${publicBaseUrl(request)}/join/${token}`,
      rawLinkShownOnce: true,
    })
  } catch (error) {
    console.error('[team invites PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to change this team invitation.' }, { status: 500 })
  }
}
