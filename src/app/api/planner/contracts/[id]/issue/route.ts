import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import { issueContractVersion, Phase2ContractError } from '@/lib/contracts/phase2'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id } = await params
    const data = await issueContractVersion({
      weddingId: access.context.weddingId,
      contractId: id,
      actorId: access.context.session.userId,
    })
    await logAuditEvent({
      action: 'contract.version_issued',
      resourceType: 'ContractVersion',
      resourceId: data.versionId,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: {
        contractId: data.contractId,
        contractNumber: data.contractNumber,
        versionNumber: data.versionNumber,
        contentSha256: data.contentSha256,
        artifactSha256: data.artifactSha256,
        artifactVaultObjectId: data.artifactVaultObjectId,
        reviewGrantCount: data.reviewLinks.length,
        acceptanceRecorded: false,
      },
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Phase2ContractError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[PHASE2 CONTRACT ISSUE POST] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to issue the Wewed contract version.' }, { status: 500 })
  }
}
