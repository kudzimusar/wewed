import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  AdminHistoricalEngagementAccessError,
  assertAdminHistoricalWeddingScope,
} from '@/lib/admin-historical-engagement'
import { getTransactionGovernance, Phase4GovernanceError } from '@/lib/contracts/phase4'
import { requireWewedAdmin, WewedAdminAccessError } from '@/lib/wewed-admin'

function responseFor(error: unknown) {
  if (
    error instanceof WewedAdminAccessError ||
    error instanceof AdminHistoricalEngagementAccessError ||
    error instanceof Phase4GovernanceError
  ) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  console.error('[ADMIN TRANSACTION GOVERNANCE DETAIL] error:', error)
  return NextResponse.json({ success: false, error: 'Unable to load governed transaction details.' }, { status: 500 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireWewedAdmin(request, 'admin.support.read')
    const { id } = await params
    const engagement = await db.serviceEngagement.findUnique({
      where: { id },
      select: { id: true, weddingId: true },
    })
    if (!engagement) {
      return NextResponse.json({ success: false, error: 'Service engagement was not found.' }, { status: 404 })
    }
    await assertAdminHistoricalWeddingScope(admin, engagement.weddingId)
    const data = await getTransactionGovernance({ weddingId: engagement.weddingId, engagementId: engagement.id })
    return NextResponse.json({
      success: true,
      admin: { userId: admin.session.userId, role: admin.adminRole, readOnly: true },
      data,
    })
  } catch (error) {
    return responseFor(error)
  }
}
