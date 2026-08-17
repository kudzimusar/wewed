import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession, setAppSessionCookie } from '@/lib/app-session'
import { syncPlannerMembershipBusinessLink } from '@/lib/planner-membership-business-link'
import {
  TEAM_INVITE_SECTION,
  hashTeamInviteToken,
  inviteIsExpired,
  parseTeamInviteState,
  teamInvitePermissionSummary,
  teamInviteRoleLabel,
  type TeamInviteRole,
  type TeamInviteState,
} from '@/lib/team-invite'

interface InviteRow {
  id: string
  value: string
  weddingId: string
  weddingTitle: string
  weddingDate: Date
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
}

interface MembershipRow {
  id: string
  role: string
  status: string
}

const ROLE_RANK: Record<string, number> = {
  viewer: 1,
  coordinator: 2,
  planner: 3,
  owner: 4,
  admin: 5,
}

function safeToken(value: string): string | null {
  return /^[A-Za-z0-9_-]{30,120}$/.test(value) ? value : null
}

function effectiveInviteStatus(state: TeamInviteState): 'pending' | 'accepted' | 'revoked' | 'expired' {
  if (state.status === 'pending' && inviteIsExpired(state)) return 'expired'
  return state.status
}

async function inviteByHash(tokenHash: string): Promise<InviteRow | null> {
  const rows = await db.$queryRawUnsafe<InviteRow[]>(
    `
      SELECT wc.id,
             wc.value,
             wc."weddingId",
             w.title AS "weddingTitle",
             w.date AS "weddingDate",
             w.venue,
             w."venueCity",
             w."venueCountry",
             w."coupleId"
      FROM public."WeddingContent" wc
      JOIN public."Wedding" w ON w.id = wc."weddingId"
      WHERE wc.section = $1 AND wc.field = $2
      LIMIT 1
    `,
    TEAM_INVITE_SECTION,
    tokenHash,
  )
  return rows[0] ?? null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token: raw } = await params
    const token = safeToken(raw)
    if (!token) return NextResponse.json({ success: false, error: 'Invitation not found.' }, { status: 404 })
    const invite = await inviteByHash(hashTeamInviteToken(token))
    if (!invite) return NextResponse.json({ success: false, error: 'Invitation not found.' }, { status: 404 })
    const state = parseTeamInviteState(invite.value)
    if (!state) return NextResponse.json({ success: false, error: 'Invitation is unavailable.' }, { status: 410 })
    const status = effectiveInviteStatus(state)

    return NextResponse.json({
      success: true,
      data: {
        weddingTitle: invite.weddingTitle,
        weddingDate: invite.weddingDate.toISOString(),
        location: [invite.venue, invite.venueCity, invite.venueCountry].filter(Boolean).join(' · '),
        role: state.role,
        roleLabel: teamInviteRoleLabel(state.role),
        permissionSummary: teamInvitePermissionSummary(state.role),
        invitedByLabel: state.invitedByLabel,
        note: state.note,
        inviteeEmailHint: state.inviteeEmail ? state.inviteeEmail.replace(/^(.{1,2}).*(@.*)$/, '$1…$2') : null,
        expiresAt: state.expiresAt,
        status,
        canAccept: status === 'pending',
      },
    })
  } catch (error) {
    console.error('[team join GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to read this invitation.' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json(
      { success: false, code: 'SIGN_IN_REQUIRED', error: 'Sign in or create your Wewed account before accepting this invitation.' },
      { status: 401 },
    )
  }

  try {
    const { token: raw } = await params
    const token = safeToken(raw)
    if (!token) return NextResponse.json({ success: false, error: 'Invitation not found.' }, { status: 404 })
    const tokenHash = hashTeamInviteToken(token)

    const result = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<InviteRow[]>(
        `
          SELECT wc.id,
                 wc.value,
                 wc."weddingId",
                 w.title AS "weddingTitle",
                 w.date AS "weddingDate",
                 w.venue,
                 w."venueCity",
                 w."venueCountry",
                 w."coupleId"
          FROM public."WeddingContent" wc
          JOIN public."Wedding" w ON w.id = wc."weddingId"
          WHERE wc.section = $1 AND wc.field = $2
          FOR UPDATE OF wc
        `,
        TEAM_INVITE_SECTION,
        tokenHash,
      )
      const invite = rows[0]
      if (!invite) return { error: 'Invitation not found.', status: 404 as const }
      const state = parseTeamInviteState(invite.value)
      if (!state) return { error: 'Invitation is unavailable.', status: 410 as const }

      const status = effectiveInviteStatus(state)
      if (status !== 'pending') {
        await tx.auditEvent.create({
          data: {
            action: 'team_invite.accept_rejected',
            resourceType: 'team_invite',
            resourceId: invite.id,
            afterValue: JSON.stringify({ reason: status, userId: session.userId }),
            weddingId: invite.weddingId,
            actorId: session.userId,
          },
        })
        return {
          error: status === 'expired' ? 'This invitation has expired.' : status === 'accepted' ? 'This invitation has already been used.' : 'This invitation has been revoked.',
          status: 410 as const,
        }
      }

      if (state.attemptCount >= 10) {
        const locked: TeamInviteState = { ...state, status: 'revoked' }
        await tx.weddingContent.update({ where: { id: invite.id }, data: { value: JSON.stringify(locked) } })
        await tx.auditEvent.create({
          data: {
            action: 'team_invite.accept_rejected', resourceType: 'team_invite', resourceId: invite.id,
            afterValue: JSON.stringify({ reason: 'attempt_limit', userId: session.userId }), weddingId: invite.weddingId, actorId: session.userId,
          },
        })
        return { error: 'This invitation is no longer available.', status: 429 as const }
      }

      if (state.inviteeEmail && state.inviteeEmail.toLowerCase() !== session.email.toLowerCase()) {
        const nextState: TeamInviteState = { ...state, attemptCount: state.attemptCount + 1 }
        await tx.weddingContent.update({ where: { id: invite.id }, data: { value: JSON.stringify(nextState) } })
        await tx.auditEvent.create({
          data: {
            action: 'team_invite.accept_rejected', resourceType: 'team_invite', resourceId: invite.id,
            afterValue: JSON.stringify({ reason: 'email_mismatch', userId: session.userId }), weddingId: invite.weddingId, actorId: session.userId,
          },
        })
        return { error: 'This invitation was issued for a different Wewed account.', status: 403 as const }
      }

      const existingMemberships = await tx.$queryRawUnsafe<MembershipRow[]>(
        `SELECT id, role, status
         FROM public."WeddingMembership"
         WHERE "userId" = $1 AND "weddingId" = $2
         FOR UPDATE`,
        session.userId,
        invite.weddingId,
      )
      const existing = existingMemberships[0]
      const existingRank = existing?.status === 'active' ? (ROLE_RANK[existing.role] ?? 0) : 0
      const invitedRank = ROLE_RANK[state.role] ?? 0
      const finalRole: TeamInviteRole | string = existingRank >= invitedRank ? existing!.role : state.role
      let membershipId = existing?.id

      if (existing) {
        await tx.$executeRawUnsafe(
          `
            UPDATE public."WeddingMembership"
            SET role = $3,
                status = 'active',
                "invitedById" = COALESCE("invitedById", $4),
                "acceptedAt" = COALESCE("acceptedAt", CURRENT_TIMESTAMP),
                "revokedAt" = NULL,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $1 AND "weddingId" = $2
          `,
          existing.id,
          invite.weddingId,
          finalRole,
          state.invitedById,
        )
      } else {
        membershipId = `wm_${randomUUID().replace(/-/g, '')}`
        await tx.$executeRawUnsafe(
          `
            INSERT INTO public."WeddingMembership" (
              id, "userId", "weddingId", role, status, permissions,
              "invitedById", "acceptedAt", "revokedAt", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, 'active', NULL, $5, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          membershipId,
          session.userId,
          invite.weddingId,
          finalRole,
          state.invitedById,
        )
      }

      if (finalRole === 'owner') {
        await tx.user.update({
          where: { id: session.userId },
          data: { coupleId: session.coupleId ?? invite.coupleId, isActive: true },
        })
      } else {
        await tx.user.update({ where: { id: session.userId }, data: { isActive: true } })
      }

      const acceptedState: TeamInviteState = {
        ...state,
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
        acceptedById: session.userId,
        attemptCount: state.attemptCount + 1,
      }
      await tx.weddingContent.update({ where: { id: invite.id }, data: { value: JSON.stringify(acceptedState) } })
      await tx.auditEvent.create({
        data: {
          action: 'team_invite.accepted',
          resourceType: 'team_invite',
          resourceId: invite.id,
          beforeValue: JSON.stringify({ role: state.role, status: 'pending' }),
          afterValue: JSON.stringify({ role: finalRole, status: 'accepted', membershipId }),
          weddingId: invite.weddingId,
          actorId: session.userId,
        },
      })
      return {
        invite,
        finalRole,
        membershipId: membershipId!,
      }
    })

    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    await syncPlannerMembershipBusinessLink({
      membershipId: result.membershipId,
      userId: session.userId,
      weddingId: result.invite.weddingId,
      role: result.finalRole,
      status: 'active',
    })

    const destination = result.finalRole === 'owner' ? '/couple' : '/planner/overview#planner-workspace'
    const response = NextResponse.json({
      success: true,
      data: {
        weddingTitle: result.invite.weddingTitle,
        role: result.finalRole,
        destination,
      },
    })
    setAppSessionCookie(response, {
      userId: session.userId,
      authUserId: session.authUserId,
      email: session.email,
      role: session.role,
      coupleId: result.finalRole === 'owner' ? (session.coupleId ?? result.invite.coupleId) : session.coupleId,
      activeWeddingId: result.invite.weddingId,
    })
    return response
  } catch (error) {
    console.error('[team join POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to accept this invitation.' }, { status: 500 })
  }
}
