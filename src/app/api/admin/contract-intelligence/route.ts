import { NextRequest, NextResponse } from 'next/server'
import { AdminHistoricalEngagementAccessError, assertAdminHistoricalWeddingScope, listAdminHistoricalWeddings } from '@/lib/admin-historical-engagement'
import { getPrivacySafeAdminIntelligence } from '@/lib/contracts/phase6'
import { requireWewedAdmin, WewedAdminAccessError } from '@/lib/wewed-admin'

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireWewedAdmin(request, 'admin.support.read')
    const weddings = await listAdminHistoricalWeddings(admin)
    const requestedWeddingId = request.nextUrl.searchParams.get('weddingId')?.trim() || weddings[0]?.id || ''
    if (!requestedWeddingId) return privateJson({ success: true, weddings: [], selectedWedding: null, intelligence: null })
    const selectedWedding = await assertAdminHistoricalWeddingScope(admin, requestedWeddingId)
    const intelligence = await getPrivacySafeAdminIntelligence({ weddingId: selectedWedding.id })
    return privateJson({
      success: true,
      weddings: weddings.map((item) => ({ id: item.id, title: item.title, date: item.date.toISOString() })),
      selectedWedding: { id: selectedWedding.id, title: selectedWedding.title, date: selectedWedding.date.toISOString() },
      intelligence,
    })
  } catch (error) {
    if (error instanceof WewedAdminAccessError || error instanceof AdminHistoricalEngagementAccessError) {
      return privateJson({ success: false, error: error.message }, error.status)
    }
    console.error('[ADMIN PHASE 6 CONTRACT INTELLIGENCE] error:', error)
    return privateJson({ success: false, error: 'Unable to load privacy-safe contract intelligence.' }, 500)
  }
}
