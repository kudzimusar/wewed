import { NextRequest, NextResponse } from 'next/server'
import {
  assignGateOperator,
  createWeddingGate,
  disableWeddingGate,
  listWeddingGateAuthority,
  resolveGateManagementContext,
  revokeGateOperator,
} from '@/lib/gate-authority'

function json(payload: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(payload, { status, headers: { 'cache-control': 'no-store', ...headers } })
}

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error)
  if (['GATE_NOT_FOUND', 'GATE_ASSIGNMENT_NOT_FOUND', 'OPERATOR_NOT_FOUND'].includes(message)) return 404
  if (['GATE_DISABLED', 'OPERATOR_NOT_ACTIVE'].includes(message)) return 409
  if (message.includes('unique constraint') || message.includes('WeddingGate_weddingId_name_key')) return 409
  if (['INVALID_GATE_NAME', 'GATE_CAPABILITIES_REQUIRED', 'UNKNOWN_GATE_CAPABILITY', 'INVALID_ASSIGNMENT_WINDOW'].includes(message)) return 400
  return 500
}

export async function GET(request: NextRequest) {
  const access = await resolveGateManagementContext(request)
  if (!access.ok) {
    return json({ success: false, code: access.code, error: access.error }, access.status, access.headers)
  }

  const data = await listWeddingGateAuthority(access.context.weddingId)
  return json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const access = await resolveGateManagementContext(request)
  if (!access.ok) {
    return json({ success: false, code: access.code, error: access.error }, access.status, access.headers)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return json({ success: false, error: 'Invalid JSON body.' }, 400)
  }

  const action = typeof body.action === 'string' ? body.action : ''
  try {
    switch (action) {
      case 'create_gate': {
        const name = typeof body.name === 'string' ? body.name : ''
        const gate = await createWeddingGate({
          weddingId: access.context.weddingId,
          name,
          actorUserId: access.context.session.userId,
        })
        return json({ success: true, data: gate }, 201)
      }
      case 'disable_gate': {
        const gateId = typeof body.gateId === 'string' ? body.gateId.trim() : ''
        if (!gateId) return json({ success: false, error: 'gateId is required.' }, 400)
        const gate = await disableWeddingGate({
          weddingId: access.context.weddingId,
          gateId,
          actorUserId: access.context.session.userId,
        })
        return json({ success: true, data: gate })
      }
      case 'assign_operator': {
        const gateId = typeof body.gateId === 'string' ? body.gateId.trim() : ''
        const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
        if (!gateId || !userId) {
          return json({ success: false, error: 'gateId and userId are required.' }, 400)
        }
        const activeFrom = typeof body.activeFrom === 'string' ? new Date(body.activeFrom) : null
        const expiresAt = typeof body.expiresAt === 'string' ? new Date(body.expiresAt) : null
        if ((activeFrom && Number.isNaN(activeFrom.getTime())) || (expiresAt && Number.isNaN(expiresAt.getTime()))) {
          return json({ success: false, error: 'Invalid assignment date.' }, 400)
        }
        const assignment = await assignGateOperator({
          weddingId: access.context.weddingId,
          gateId,
          userId,
          capabilities: body.capabilities,
          activeFrom,
          expiresAt,
          actorUserId: access.context.session.userId,
        })
        return json({ success: true, data: assignment }, 201)
      }
      case 'revoke_assignment': {
        const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : ''
        if (!assignmentId) return json({ success: false, error: 'assignmentId is required.' }, 400)
        const assignment = await revokeGateOperator({
          weddingId: access.context.weddingId,
          assignmentId,
          actorUserId: access.context.session.userId,
        })
        return json({ success: true, data: assignment })
      }
      default:
        return json({ success: false, error: 'Unknown gate-management action.' }, 400)
    }
  } catch (error) {
    console.error('[weddings/gates] Error:', error)
    const message = error instanceof Error ? error.message : 'Gate operation failed.'
    return json({ success: false, error: message }, errorStatus(error))
  }
}
