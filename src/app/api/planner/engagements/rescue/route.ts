import { NextRequest, NextResponse } from 'next/server'
import { calculatePaidVendorRescue } from '@/lib/planner-engagement-rescue'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error

  try {
    const result = await calculatePaidVendorRescue(access.context.weddingId)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[PLANNER ENGAGEMENT RESCUE GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to calculate paid-vendor rescue status' },
      { status: 500 },
    )
  }
}
