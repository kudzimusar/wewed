import { NextRequest, NextResponse } from 'next/server'
import {
  plannerWeddingDayState,
  requireWeddingDayOperator,
} from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const actor = await requireWeddingDayOperator(request, ['planner', 'couple', 'admin'])
  if (!actor) {
    return NextResponse.json(
      { success: false, error: 'Forbidden — Planner Wedding Day access required.' },
      { status: 403 },
    )
  }

  const data = await plannerWeddingDayState(actor.weddingId)
  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
