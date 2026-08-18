import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import { Phase2ContractError, rotateContractReviewLinks } from '@/lib/contracts/phase2'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id } = await params
    const data = await rotateContractReviewLinks({
      weddingId: access.context.weddingId,
      contractId: id,
      actorId: access.context.session.userId,
    })
    await logAuditEvent({
      action: 'contract.review_links_rotated',
      resourceType: 'Contract',
      resourceId: id,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: { reviewGrantCount: data.reviewLinks.length, rawTokensPersisted: false },
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Phase2ContractError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[PHASE2 REVIEW LINKS POST] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create new secure review links.' }, { status: 500 })
  }
}
