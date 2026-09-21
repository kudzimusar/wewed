import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingDayOperator } from '@/lib/wedding-day'
import { signedNativeWeddingDayManifest } from '@/lib/wedding-day-manifest'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const actor = await requireWeddingDayOperator(request, [
    'usher',
    'planner',
    'couple',
    'admin',
  ])
  if (!actor) {
    return NextResponse.json(
      { success: false, error: 'Forbidden — Wedding Day manifest access required.' },
      { status: 403 },
    )
  }

  try {
    const data = await signedNativeWeddingDayManifest(actor.weddingId)
    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to build Wedding Day manifest.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
