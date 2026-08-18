import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import { issueContractAmendment, Phase3ContractError } from '@/lib/contracts/phase3'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; amendmentId: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id: contractId, amendmentId } = await params
    const data = await issueContractAmendment({ weddingId: access.context.weddingId, amendmentId, actorId: access.context.session.userId })
    await logAuditEvent({
      action: 'contract.amendment_issued',
      resourceType: 'Contract',
      resourceId: contractId,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: { amendmentId, versionId: data.versionId, versionNumber: data.versionNumber, contentSha256: data.contentSha256, artifactSha256: data.artifactSha256, reviewPartyCount: data.reviewLinks.length },
    })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof Phase3ContractError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[PHASE3 AMENDMENT ISSUE] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to issue the governed amendment.' }, { status: 500 })
  }
}
