import { NextRequest, NextResponse } from 'next/server'
import {
  engagementEvidenceSignedUrl,
  VaultEvidenceError,
} from '@/lib/vault/engagement-evidence'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error

  try {
    const { id } = await params
    const authorized = await engagementEvidenceSignedUrl({
      weddingId: access.context.weddingId,
      vaultObjectId: id,
    })
    return NextResponse.json({
      success: true,
      data: {
        ...authorized,
        expiresInSeconds: 600,
      },
    })
  } catch (error) {
    if (error instanceof VaultEvidenceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      )
    }
    console.error('[PLANNER VAULT GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to authorize Vault evidence download' },
      { status: 500 },
    )
  }
}
