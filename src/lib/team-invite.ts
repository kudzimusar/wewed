import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

export const TEAM_INVITE_SECTION = 'team_invite'
export const TEAM_INVITE_VERSION = 1
export const TEAM_INVITE_EXPIRY_HOURS = [1, 24, 72, 168] as const
export const TEAM_INVITE_ROLES = ['owner', 'planner', 'coordinator', 'viewer'] as const

export type TeamInviteRole = (typeof TEAM_INVITE_ROLES)[number]
export type TeamInviteStatus = 'pending' | 'accepted' | 'revoked'

export interface TeamInviteState {
  version: 1
  role: TeamInviteRole
  status: TeamInviteStatus
  note: string | null
  inviteeEmail: string | null
  invitedById: string
  invitedByLabel: string
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
  acceptedById: string | null
  attemptCount: number
  rotatedFromId: string | null
  rotatedToId: string | null
}

export function isTeamInviteRole(value: unknown): value is TeamInviteRole {
  return typeof value === 'string' && TEAM_INVITE_ROLES.includes(value as TeamInviteRole)
}

export function createTeamInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashTeamInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function parseTeamInviteState(value: string | null | undefined): TeamInviteState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<TeamInviteState>
    if (
      parsed.version !== TEAM_INVITE_VERSION ||
      !isTeamInviteRole(parsed.role) ||
      !['pending', 'accepted', 'revoked'].includes(String(parsed.status)) ||
      typeof parsed.invitedById !== 'string' ||
      typeof parsed.invitedByLabel !== 'string' ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.expiresAt !== 'string'
    ) return null
    return {
      version: TEAM_INVITE_VERSION,
      role: parsed.role,
      status: parsed.status as TeamInviteStatus,
      note: typeof parsed.note === 'string' ? parsed.note : null,
      inviteeEmail: typeof parsed.inviteeEmail === 'string' ? parsed.inviteeEmail : null,
      invitedById: parsed.invitedById,
      invitedByLabel: parsed.invitedByLabel,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      acceptedAt: typeof parsed.acceptedAt === 'string' ? parsed.acceptedAt : null,
      acceptedById: typeof parsed.acceptedById === 'string' ? parsed.acceptedById : null,
      attemptCount: Number.isFinite(parsed.attemptCount) ? Number(parsed.attemptCount) : 0,
      rotatedFromId: typeof parsed.rotatedFromId === 'string' ? parsed.rotatedFromId : null,
      rotatedToId: typeof parsed.rotatedToId === 'string' ? parsed.rotatedToId : null,
    }
  } catch {
    return null
  }
}

export function teamInviteRoleLabel(role: TeamInviteRole): string {
  if (role === 'owner') return 'Owner / partner'
  if (role === 'planner') return 'Planner'
  if (role === 'coordinator') return 'Coordinator'
  return 'Viewer / member'
}

export function teamInvitePermissionSummary(role: TeamInviteRole): string[] {
  if (role === 'owner') return [
    'Full wedding/project access',
    'Manage planning data and team access',
    'Manage guest, budget, vendor, timeline and seating work',
  ]
  if (role === 'planner') return [
    'Edit planner tasks and operational worksheets',
    'Manage guests, budget, vendors, timeline and seating',
    'Import and export planner data where enabled',
  ]
  if (role === 'coordinator') return [
    'Edit planner tasks, guests, timeline and seating',
    'View budget and vendor information',
    'Export planner data where enabled',
  ]
  return [
    'View planner tasks and wedding worksheets',
    'View guests, budget, vendors, timeline and seating',
    'No generic editing authority',
  ]
}

export function canGrantTeamInviteRole(
  inviterRole: string,
  targetRole: TeamInviteRole,
): boolean {
  if (inviterRole === 'admin' || inviterRole === 'owner') return true
  if (inviterRole === 'planner') return targetRole !== 'owner'
  if (inviterRole === 'coordinator') return targetRole === 'coordinator' || targetRole === 'viewer'
  return targetRole === 'viewer'
}

export function inviteIsExpired(invite: TeamInviteState, now = Date.now()): boolean {
  const expiry = new Date(invite.expiresAt).getTime()
  return !Number.isFinite(expiry) || expiry <= now
}
