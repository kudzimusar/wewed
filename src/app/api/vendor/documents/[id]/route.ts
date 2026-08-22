import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { engagementEvidenceSignedUrl } from '@/lib/vault/engagement-evidence'
import { vendorCommercialDocumentAccess } from '@/lib/vault/vendor-commercial-access'

function privateResponse(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = readAppSession(request)
  if (!session) return privateResponse({ success: false, error: 'Sign in to the Vendor workspace.' }, { status: 401 })
  if (session.role !== 'vendor') return privateResponse({ success: false, error: 'Vendor access is required.' }, { status: 403 })

  try {
    const { id } = await params
    const link = await vendorCommercialDocumentAccess({ userId: session.userId, email: session.email }, id)
    if (!link) return privateResponse({ success: false, error: 'Document not found for your Service Engagements.' }, { status: 404 })

    const data = await engagementEvidenceSignedUrl({
      weddingId: link.weddingId,
      vaultObjectId: link.vaultObjectId,
    })
    return privateResponse({ success: true, data })
  } catch (error) {
    console.error('[VENDOR COMMERCIAL DOCUMENT GET] error:', error)
    return privateResponse({ success: false, error: 'Could not authorize this private document.' }, { status: 500 })
  }
}
