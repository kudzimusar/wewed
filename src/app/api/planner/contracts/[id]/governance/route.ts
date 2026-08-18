import { NextRequest, NextResponse } from 'next/server'
import { getContractGovernanceSummary, Phase3ContractError } from '@/lib/contracts/phase3'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const { id: contractId } = await params
    const data = await getContractGovernanceSummary({ weddingId: access.context.weddingId, contractId })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Phase3ContractError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[PHASE3 GOVERNANCE GET] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load contract acceptance governance.' }, { status: 500 })
  }
}
