import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingArchitectPlanningAccess } from '@/lib/wedding-architect-access'
import { buildWeddingArchitectMarketplacePlan } from '@/lib/wedding-architect-marketplace'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await requireWeddingArchitectPlanningAccess(request)
  if (access.error) return access.error

  try {
    const result = await buildWeddingArchitectMarketplacePlan({ weddingId: access.context.weddingId })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Wedding Architect could not build the plan.'
    const isInputGap = /confirm|budget|country|city|required/i.test(message)
    return NextResponse.json({ success: false, error: message }, { status: isInputGap ? 409 : 503 })
  }
}

export const dynamic = 'force-dynamic'
