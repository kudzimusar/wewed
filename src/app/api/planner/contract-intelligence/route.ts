import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { getContractIntelligenceDashboard } from '@/lib/contracts/phase6'

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.dashboard.view')
  if (access.error) return access.error
  try {
    const dashboard = await getContractIntelligenceDashboard({
      weddingId: access.context.weddingId,
      query: request.nextUrl.searchParams.get('q'),
    })
    return privateJson({ success: true, dashboard })
  } catch (error) {
    console.error('[PHASE 6 CONTRACT INTELLIGENCE] dashboard error:', error)
    return privateJson({ success: false, error: 'Unable to load contract intelligence.' }, 500)
  }
}
