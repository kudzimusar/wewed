import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import { createOrRefreshContractDraft, Phase2ContractError } from '@/lib/contracts/phase2'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id } = await params
    const data = await createOrRefreshContractDraft({
      weddingId: access.context.weddingId,
      engagementId: id,
      actorId: access.context.session.userId,
    })
    await logAuditEvent({
      action: 'contract.draft_generated',
      resourceType: 'Contract',
      resourceId: data.contractId,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: {
        contractNumber: data.contractNumber,
        versionNumber: data.versionNumber,
        contentSha256: data.contentSha256,
        templateReviewStatus: data.templateReviewStatus,
        acceptanceRecorded: false,
      },
    })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof Phase2ContractError) {
      return NextResponse.json({ success: false, error: error.message, field: error.field }, { status: error.status })
    }
    console.error('[PHASE2 CONTRACT DRAFT POST] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate the Wewed contract draft.' }, { status: 500 })
  }
}
