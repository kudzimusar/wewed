import { NextRequest, NextResponse } from 'next/server'
import { getServiceEngagementDealRoom, Phase2ContractError } from '@/lib/contracts/phase2'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const { id } = await params
    const data = await getServiceEngagementDealRoom(access.context.weddingId, id)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Phase2ContractError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[PHASE2 DEAL ROOM GET] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load the service engagement Deal Room.' }, { status: 500 })
  }
}
