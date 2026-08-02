import { NextResponse } from 'next/server'
import { MarketplaceAccessError } from '@/lib/marketplace-access'
import { WewedAdminAccessError } from '@/lib/wewed-admin'

export function marketplaceErrorResponse(error: unknown): NextResponse {
  if (error instanceof MarketplaceAccessError || error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }

  console.error('[planner-marketplace] Unexpected error:', error)
  return NextResponse.json(
    { success: false, error: 'The planner marketplace request could not be completed.' },
    { status: 500 },
  )
}
