import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import { Phase3ContractError, rotatePendingPhase3ReviewLinks } from '@/lib/contracts/phase3'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string; versionId: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { contractId, versionId } = await params
    const data = await rotatePendingPhase3ReviewLinks({ weddingId: access.context.weddingId, contractVersionId: versionId, actorId: access.context.session.userId })
    await logAuditEvent({
      action: 'contract.pending_review_links_rotated',
      resourceType: 'Contract',
      resourceId: contractId,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: { versionId, pendingPartyCount: data.reviewLinks.length, acceptedPartyLinksUntouched: true },
    })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof Phase3ContractError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[PHASE3 REVIEW LINK ROTATE] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to rotate pending contract review links.' }, { status: 500 })
  }
}
