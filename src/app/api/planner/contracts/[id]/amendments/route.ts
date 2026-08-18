import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import { createContractAmendmentDraft, Phase3ContractError } from '@/lib/contracts/phase3'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id: contractId } = await params
    const body = await request.json().catch(() => ({}))
    const data = await createContractAmendmentDraft({
      weddingId: access.context.weddingId,
      contractId,
      actorId: access.context.session.userId,
      reason: body?.reason,
      changes: typeof body?.changes === 'object' && body.changes ? body.changes : {},
    })
    await logAuditEvent({
      action: 'contract.amendment_draft_created',
      resourceType: 'Contract',
      resourceId: contractId,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: { amendmentId: data.amendmentId, baseVersionId: data.baseVersionId, proposedVersionId: data.proposedVersionId, proposedVersionNumber: data.proposedVersionNumber, diff: data.diff },
    })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof Phase3ContractError) {
      return NextResponse.json({ success: false, error: error.message, field: error.field }, { status: error.status })
    }
    console.error('[PHASE3 AMENDMENT CREATE] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create the governed amendment draft.' }, { status: 500 })
  }
}
