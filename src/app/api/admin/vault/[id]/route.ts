import { NextRequest, NextResponse } from 'next/server'
import {
  AdminHistoricalEngagementAccessError,
  assertAdminHistoricalWeddingScope,
} from '@/lib/admin-historical-engagement'
import {
  requireWewedAdmin,
  WewedAdminAccessError,
} from '@/lib/wewed-admin'
import {
  engagementEvidenceSignedUrl,
  VaultEvidenceError,
} from '@/lib/vault/engagement-evidence'

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  if (error instanceof AdminHistoricalEngagementAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  if (error instanceof VaultEvidenceError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  console.error('[ADMIN VAULT EVIDENCE] error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to authorize service-record evidence.' },
    { status: 500 },
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireWewedAdmin(request, 'admin.support.read')
    const weddingId = request.nextUrl.searchParams.get('weddingId')?.trim() || ''
    await assertAdminHistoricalWeddingScope(context, weddingId)
    const { id } = await params
    const authorized = await engagementEvidenceSignedUrl({
      weddingId,
      vaultObjectId: id,
    })

    return NextResponse.json({
      success: true,
      data: { ...authorized, expiresInSeconds: 600 },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
