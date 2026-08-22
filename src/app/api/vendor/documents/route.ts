import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { listVendorCommercialDocuments } from '@/lib/vault/vendor-commercial-access'

function privateResponse(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) return privateResponse({ success: false, error: 'Sign in to the Vendor workspace.' }, { status: 401 })
  if (session.role !== 'vendor') return privateResponse({ success: false, error: 'Vendor access is required.' }, { status: 403 })

  try {
    const data = await listVendorCommercialDocuments({ userId: session.userId, email: session.email })
    return privateResponse({ success: true, count: data.length, data })
  } catch (error) {
    console.error('[VENDOR COMMERCIAL DOCUMENTS GET] error:', error)
    return privateResponse({ success: false, error: 'Could not load your Service Engagement documents.' }, { status: 500 })
  }
}
