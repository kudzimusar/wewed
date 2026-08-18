import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import {
  addDisputeEvidence,
  addDisputeIssue,
  createPaymentMilestone,
  getTransactionGovernance,
  openDisputeCase,
  Phase4GovernanceError,
  recordDisputeEvent,
  recordDisputeOutcome,
  recordManagedPayment,
  releaseEvidenceHold,
  reverseManagedPayment,
} from '@/lib/contracts/phase4'
import { requireWeddingPermission } from '@/lib/wedding-access'

function errorResponse(error: unknown) {
  if (error instanceof Phase4GovernanceError) {
    return NextResponse.json({ success: false, error: error.message, field: error.field }, { status: error.status })
  }
  console.error('[PHASE4 TRANSACTION GOVERNANCE] error:', error)
  return NextResponse.json({ success: false, error: 'Wewed could not complete this governed transaction action.' }, { status: 500 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const { id } = await params
    const data = await getTransactionGovernance({ weddingId: access.context.weddingId, engagementId: id })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id } = await params
    const contentType = request.headers.get('content-type') || ''
    const actorId = access.context.session.userId
    const weddingId = access.context.weddingId
    let action = ''
    let result: unknown

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      action = String(form.get('action') || '')
      if (action === 'recordPayment') {
        const file = form.get('proofFile')
        result = await recordManagedPayment({
          weddingId,
          engagementId: id,
          actorId,
          entryType: form.get('entryType'),
          amount: form.get('amount'),
          currency: form.get('currency'),
          paidAt: form.get('paidAt'),
          milestoneId: form.get('milestoneId'),
          method: form.get('method'),
          reference: form.get('reference'),
          notes: form.get('notes'),
          source: form.get('source'),
          proofRequired: String(form.get('proofRequired') || 'true') !== 'false',
          proofWaiverReason: form.get('proofWaiverReason'),
          proofFile: file instanceof File && file.size > 0 ? file : null,
        })
      } else if (action === 'addDisputeEvidence') {
        const file = form.get('file')
        if (!(file instanceof File) || file.size <= 0) throw new Phase4GovernanceError('Choose an evidence file.', 400, 'file')
        result = await addDisputeEvidence({
          weddingId,
          engagementId: id,
          disputeCaseId: String(form.get('disputeCaseId') || ''),
          issueId: String(form.get('issueId') || '') || null,
          actorId,
          file,
          reason: form.get('reason'),
          note: form.get('note'),
        })
      } else {
        throw new Phase4GovernanceError('Unsupported multipart transaction action.', 400, 'action')
      }
    } else {
      const body = await request.json().catch(() => ({}))
      action = String(body?.action || '')
      if (action === 'createMilestone') {
        result = await createPaymentMilestone({ weddingId, engagementId: id, actorId, ...body })
      } else if (action === 'reversePayment') {
        result = await reverseManagedPayment({ weddingId, engagementId: id, actorId, paymentId: body?.paymentId, paidAt: body?.paidAt, notes: body?.notes })
      } else if (action === 'openDispute') {
        result = await openDisputeCase({ weddingId, engagementId: id, actorId, summary: body?.summary, contractId: body?.contractId, contractVersionId: body?.contractVersionId })
      } else if (action === 'addIssue') {
        result = await addDisputeIssue({ weddingId, engagementId: id, disputeCaseId: body?.disputeCaseId, actorId, clauseReference: body?.clauseReference, category: body?.category, allegationText: body?.allegationText })
      } else if (action === 'recordEvent') {
        result = await recordDisputeEvent({ weddingId, engagementId: id, disputeCaseId: body?.disputeCaseId, actorId, issueId: body?.issueId, eventType: body?.eventType, source: body?.source, actorPartyId: body?.actorPartyId, note: body?.note, metadata: body?.metadata })
      } else if (action === 'recordOutcome') {
        result = await recordDisputeOutcome({ weddingId, engagementId: id, disputeCaseId: body?.disputeCaseId, actorId, source: body?.source, outcomeSummary: body?.outcomeSummary, remedyType: body?.remedyType, amount: body?.amount, currency: body?.currency, externalReference: body?.externalReference, evidenceVaultObjectId: body?.evidenceVaultObjectId })
      } else if (action === 'releaseHold') {
        result = await releaseEvidenceHold({ weddingId, engagementId: id, holdId: body?.holdId, actorId, releaseReason: body?.releaseReason })
      } else {
        throw new Phase4GovernanceError('Unsupported transaction governance action.', 400, 'action')
      }
    }

    await logAuditEvent({
      action: `transaction_governance.${action}`,
      resourceType: 'ServiceEngagement',
      resourceId: id,
      weddingId,
      actorId,
      afterValue: { action, result },
    })
    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
