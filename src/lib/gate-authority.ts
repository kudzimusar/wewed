import 'server-only'

import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession, type AppSession } from '@/lib/app-session'
import { shouldBlockPreviewWrite, PREVIEW_WRITE_BLOCK_MESSAGE } from '@/lib/preview-write-safety'
import {
  GATE_CAPABILITY_VOCABULARY,
  type GateCapability,
  type OperationalGrant,
  type WewedProductionAuthorityV1,
  type WorkspaceGrant,
} from '@/lib/production-authority/contract'
import { resolveProductionAuthority } from '@/lib/production-authority/resolver'

export type GateManagementContext = {
  session: AppSession
  authority: WewedProductionAuthorityV1
  weddingGrant: WorkspaceGrant
  weddingId: string
}

export type GateManagementResult =
  | { ok: true; context: GateManagementContext }
  | { ok: false; status: number; code: string; error: string; headers?: Record<string, string> }

export type WeddingGateRecord = {
  id: string
  weddingId: string
  name: string
  status: 'active' | 'disabled'
  createdAt: string
  updatedAt: string
}

export type WeddingGateAssignmentRecord = {
  id: string
  weddingId: string
  gateId: string
  userId: string
  userEmail: string
  userName: string | null
  operatorRole: 'usher'
  capabilities: GateCapability[]
  activeFrom: string
  expiresAt: string | null
  revokedAt: string | null
  revokedByUserId: string | null
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
}

type GateRow = {
  id: string
  weddingId: string
  name: string
  status: string
  createdAt: Date
  updatedAt: Date
}

type AssignmentRow = {
  id: string
  weddingId: string
  gateId: string
  userId: string
  userEmail: string
  userName: string | null
  operatorRole: string
  capabilities: string | null
  activeFrom: Date
  expiresAt: Date | null
  revokedAt: Date | null
  revokedByUserId: string | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

const MANAGEABLE_WORKSPACE_KINDS = new Set(['couple', 'planner', 'coordinator'])

export function normalizeGateCapabilities(value: unknown): GateCapability[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set<string>(GATE_CAPABILITY_VOCABULARY)
  return Array.from(
    new Set(
      value.filter(
        (item): item is GateCapability =>
          typeof item === 'string' && allowed.has(item),
      ),
    ),
  )
}

function parseCapabilities(raw: string | null): GateCapability[] {
  if (!raw) return []
  try {
    return normalizeGateCapabilities(JSON.parse(raw))
  } catch {
    return []
  }
}

function serializeGate(row: GateRow): WeddingGateRecord {
  return {
    id: row.id,
    weddingId: row.weddingId,
    name: row.name,
    status: row.status === 'active' ? 'active' : 'disabled',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeAssignment(row: AssignmentRow): WeddingGateAssignmentRecord {
  return {
    id: row.id,
    weddingId: row.weddingId,
    gateId: row.gateId,
    userId: row.userId,
    userEmail: row.userEmail,
    userName: row.userName,
    operatorRole: 'usher',
    capabilities: parseCapabilities(row.capabilities),
    activeFrom: row.activeFrom.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedByUserId: row.revokedByUserId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Gate management deliberately does NOT call the legacy getWeddingContext() admin shortcut.
 * It requires a real, current wedding-scoped production-authority grant carrying members.manage
 * (or *), so a platform/support Admin does not implicitly become a wedding Gate manager.
 */
export async function resolveGateManagementContext(
  request: NextRequest,
): Promise<GateManagementResult> {
  const session = readAppSession(request)
  if (!session) {
    return { ok: false, status: 401, code: 'SESSION_INVALID', error: 'Your session is no longer valid.' }
  }

  const authority = await resolveProductionAuthority(session.userId, {
    authUserId: session.authUserId,
  })
  if (authority.accountStatus !== 'authorized') {
    return { ok: false, status: 403, code: 'AUTHORITY_UNAVAILABLE', error: 'This account has no active wedding authority.' }
  }

  const weddingGrant = authority.workspaceGrants.find(
    (grant) =>
      grant.scopeKind === 'wedding' &&
      grant.weddingId === session.activeWeddingId &&
      MANAGEABLE_WORKSPACE_KINDS.has(grant.workspaceKind) &&
      (grant.permissions.includes('*') || grant.permissions.includes('members.manage')),
  )

  if (!weddingGrant || !weddingGrant.weddingId) {
    return {
      ok: false,
      status: 403,
      code: 'GATE_MANAGEMENT_FORBIDDEN',
      error: 'A real wedding-scoped members.manage grant is required to manage gates.',
    }
  }

  if (request.method !== 'GET' && shouldBlockPreviewWrite({ method: request.method, weddingId: weddingGrant.weddingId })) {
    return {
      ok: false,
      status: 423,
      code: 'PREVIEW_WRITE_BLOCKED',
      error: PREVIEW_WRITE_BLOCK_MESSAGE,
      headers: { 'x-wewed-preview-write-blocked': 'true' },
    }
  }

  return {
    ok: true,
    context: {
      session,
      authority,
      weddingGrant,
      weddingId: weddingGrant.weddingId,
    },
  }
}

async function audit(input: {
  weddingId: string
  actorId: string
  action: string
  resourceType: string
  resourceId: string
  beforeValue?: unknown
  afterValue?: unknown
}) {
  await db.$executeRawUnsafe(
    `INSERT INTO public."AuditEvent"
      (id, action, "resourceType", "resourceId", "beforeValue", "afterValue",
       "weddingId", "actorId", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
    `audit_${randomUUID().replace(/-/g, '')}`,
    input.action,
    input.resourceType,
    input.resourceId,
    input.beforeValue === undefined ? null : JSON.stringify(input.beforeValue),
    input.afterValue === undefined ? null : JSON.stringify(input.afterValue),
    input.weddingId,
    input.actorId,
  )
}

export async function listWeddingGateAuthority(weddingId: string): Promise<{
  gates: WeddingGateRecord[]
  assignments: WeddingGateAssignmentRecord[]
}> {
  const [gates, assignments] = await Promise.all([
    db.$queryRawUnsafe<GateRow[]>(
      `SELECT id, "weddingId", name, status, "createdAt", "updatedAt"
         FROM public."WeddingGate"
        WHERE "weddingId" = $1
        ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, lower(name), id`,
      weddingId,
    ),
    db.$queryRawUnsafe<AssignmentRow[]>(
      `SELECT a.id, a."weddingId", a."gateId", a."userId",
              u.email AS "userEmail", u.name AS "userName",
              a."operatorRole", a.capabilities, a."activeFrom", a."expiresAt",
              a."revokedAt", a."revokedByUserId", a."createdByUserId",
              a."createdAt", a."updatedAt"
         FROM public."WeddingGateAssignment" a
         JOIN public."User" u ON u.id = a."userId"
        WHERE a."weddingId" = $1
        ORDER BY a."gateId", a."revokedAt" NULLS FIRST, lower(u.email), a.id`,
      weddingId,
    ),
  ])

  return {
    gates: gates.map(serializeGate),
    assignments: assignments.map(serializeAssignment),
  }
}

export async function createWeddingGate(input: {
  weddingId: string
  name: string
  actorUserId: string
}): Promise<WeddingGateRecord> {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 120) {
    throw new Error('INVALID_GATE_NAME')
  }

  const id = `gate_${randomUUID().replace(/-/g, '')}`
  const rows = await db.$queryRawUnsafe<GateRow[]>(
    `INSERT INTO public."WeddingGate"
      (id, "weddingId", name, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id, "weddingId", name, status, "createdAt", "updatedAt"`,
    id,
    input.weddingId,
    name,
  )
  const gate = rows[0]
  if (!gate) throw new Error('GATE_CREATE_FAILED')

  const serialized = serializeGate(gate)
  await audit({
    weddingId: input.weddingId,
    actorId: input.actorUserId,
    action: 'gate.created',
    resourceType: 'WeddingGate',
    resourceId: gate.id,
    afterValue: serialized,
  })
  return serialized
}

export async function disableWeddingGate(input: {
  weddingId: string
  gateId: string
  actorUserId: string
}): Promise<WeddingGateRecord> {
  const existing = await db.$queryRawUnsafe<GateRow[]>(
    `SELECT id, "weddingId", name, status, "createdAt", "updatedAt"
       FROM public."WeddingGate"
      WHERE id = $1 AND "weddingId" = $2
      LIMIT 1`,
    input.gateId,
    input.weddingId,
  )
  const before = existing[0]
  if (!before) throw new Error('GATE_NOT_FOUND')

  const rows = await db.$queryRawUnsafe<GateRow[]>(
    `UPDATE public."WeddingGate"
        SET status = 'disabled', "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "weddingId" = $2
      RETURNING id, "weddingId", name, status, "createdAt", "updatedAt"`,
    input.gateId,
    input.weddingId,
  )
  const gate = rows[0]
  if (!gate) throw new Error('GATE_NOT_FOUND')

  const serialized = serializeGate(gate)
  await audit({
    weddingId: input.weddingId,
    actorId: input.actorUserId,
    action: 'gate.disabled',
    resourceType: 'WeddingGate',
    resourceId: gate.id,
    beforeValue: serializeGate(before),
    afterValue: serialized,
  })
  return serialized
}

export async function assignGateOperator(input: {
  weddingId: string
  gateId: string
  userId: string
  capabilities: unknown
  activeFrom?: Date | null
  expiresAt?: Date | null
  actorUserId: string
}): Promise<WeddingGateAssignmentRecord> {
  const capabilities = normalizeGateCapabilities(input.capabilities)
  if (capabilities.length === 0) throw new Error('GATE_CAPABILITIES_REQUIRED')

  const activeFrom = input.activeFrom ?? new Date()
  const expiresAt = input.expiresAt ?? null
  if (expiresAt && expiresAt.getTime() <= activeFrom.getTime()) {
    throw new Error('INVALID_ASSIGNMENT_WINDOW')
  }

  const [gateRows, userRows] = await Promise.all([
    db.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `SELECT id, status FROM public."WeddingGate"
        WHERE id = $1 AND "weddingId" = $2 LIMIT 1`,
      input.gateId,
      input.weddingId,
    ),
    db.$queryRawUnsafe<Array<{ id: string; email: string; name: string | null; isActive: boolean; isBanned: boolean }>>(
      `SELECT u.id, u.email, u.name, u."isActive",
              COALESCE(p."isBanned", FALSE) AS "isBanned"
         FROM public."User" u
         LEFT JOIN public."UserProfile" p ON lower(p.email) = lower(u.email)
        WHERE u.id = $1
        LIMIT 1`,
      input.userId,
    ),
  ])

  const gate = gateRows[0]
  if (!gate) throw new Error('GATE_NOT_FOUND')
  if (gate.status !== 'active') throw new Error('GATE_DISABLED')

  const user = userRows[0]
  if (!user) throw new Error('OPERATOR_NOT_FOUND')
  if (!user.isActive || user.isBanned) throw new Error('OPERATOR_NOT_ACTIVE')

  const existing = await db.$queryRawUnsafe<Array<{ id: string; revokedAt: Date | null }>>(
    `SELECT id, "revokedAt"
       FROM public."WeddingGateAssignment"
      WHERE "gateId" = $1 AND "userId" = $2
      LIMIT 1`,
    input.gateId,
    input.userId,
  )

  const assignmentId = existing[0]?.id ?? `gate_assignment_${randomUUID().replace(/-/g, '')}`
  const rows = existing[0]
    ? await db.$queryRawUnsafe<AssignmentRow[]>(
        `UPDATE public."WeddingGateAssignment"
            SET "weddingId" = $2,
                "operatorRole" = 'usher',
                capabilities = $3,
                "activeFrom" = $4,
                "expiresAt" = $5,
                "revokedAt" = NULL,
                "revokedByUserId" = NULL,
                "createdByUserId" = $6,
                "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, "weddingId", "gateId", "userId",
                    $7::text AS "userEmail", $8::text AS "userName",
                    "operatorRole", capabilities, "activeFrom", "expiresAt",
                    "revokedAt", "revokedByUserId", "createdByUserId",
                    "createdAt", "updatedAt"`,
        assignmentId,
        input.weddingId,
        JSON.stringify(capabilities),
        activeFrom,
        expiresAt,
        input.actorUserId,
        user.email,
        user.name,
      )
    : await db.$queryRawUnsafe<AssignmentRow[]>(
        `INSERT INTO public."WeddingGateAssignment"
          (id, "weddingId", "gateId", "userId", "operatorRole", capabilities,
           "activeFrom", "expiresAt", "revokedAt", "createdByUserId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'usher', $5, $6, $7, NULL, $8,
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, "weddingId", "gateId", "userId",
                   $9::text AS "userEmail", $10::text AS "userName",
                   "operatorRole", capabilities, "activeFrom", "expiresAt",
                   "revokedAt", "revokedByUserId", "createdByUserId",
                   "createdAt", "updatedAt"`,
        assignmentId,
        input.weddingId,
        input.gateId,
        input.userId,
        JSON.stringify(capabilities),
        activeFrom,
        expiresAt,
        input.actorUserId,
        user.email,
        user.name,
      )

  const assignment = rows[0]
  if (!assignment) throw new Error('GATE_ASSIGNMENT_FAILED')
  const serialized = serializeAssignment(assignment)

  await audit({
    weddingId: input.weddingId,
    actorId: input.actorUserId,
    action: existing[0] ? 'gate.assignment.reactivated' : 'gate.assignment.assigned',
    resourceType: 'WeddingGateAssignment',
    resourceId: assignment.id,
    afterValue: serialized,
  })
  return serialized
}

export async function revokeGateOperator(input: {
  weddingId: string
  assignmentId: string
  actorUserId: string
}): Promise<WeddingGateAssignmentRecord> {
  const rows = await db.$queryRawUnsafe<AssignmentRow[]>(
    `UPDATE public."WeddingGateAssignment" a
        SET "revokedAt" = COALESCE(a."revokedAt", CURRENT_TIMESTAMP),
            "revokedByUserId" = CASE WHEN a."revokedAt" IS NULL THEN $3 ELSE a."revokedByUserId" END,
            "updatedAt" = CURRENT_TIMESTAMP
       FROM public."User" u
      WHERE a.id = $1
        AND a."weddingId" = $2
        AND u.id = a."userId"
      RETURNING a.id, a."weddingId", a."gateId", a."userId",
                u.email AS "userEmail", u.name AS "userName",
                a."operatorRole", a.capabilities, a."activeFrom", a."expiresAt",
                a."revokedAt", a."revokedByUserId", a."createdByUserId",
                a."createdAt", a."updatedAt"`,
    input.assignmentId,
    input.weddingId,
    input.actorUserId,
  )
  const assignment = rows[0]
  if (!assignment) throw new Error('GATE_ASSIGNMENT_NOT_FOUND')
  const serialized = serializeAssignment(assignment)

  await audit({
    weddingId: input.weddingId,
    actorId: input.actorUserId,
    action: 'gate.assignment.revoked',
    resourceType: 'WeddingGateAssignment',
    resourceId: assignment.id,
    afterValue: serialized,
  })
  return serialized
}

export function requireGateOperationalGrant(input: {
  authority: WewedProductionAuthorityV1
  grantId: string
  requiredCapability?: GateCapability
}): OperationalGrant | null {
  if (input.authority.accountStatus !== 'authorized' || !input.authority.identity) return null
  const grant = input.authority.operationalGrants.find(
    (candidate) =>
      candidate.grantId === input.grantId &&
      candidate.kind === 'gate_operator' &&
      candidate.operatorUserId === input.authority.identity?.accessUserId,
  )
  if (!grant) return null
  if (input.requiredCapability && !grant.capabilities.includes(input.requiredCapability)) return null
  return grant
}
