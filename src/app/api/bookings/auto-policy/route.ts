import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError } from '@/lib/booking-commerce'
import { getAutoBookPolicy, saveAutoBookPolicy } from '@/lib/booking-ai'
import { requireWeddingPermission } from '@/lib/wedding-access'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const data = await getAutoBookPolicy(access.context.weddingId, access.context.session.userId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[AUTOBOOK POLICY GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load AutoBook policy.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const body = await request.json() as Record<string, unknown>
    const data = await saveAutoBookPolicy({
      weddingId: access.context.weddingId,
      userId: access.context.session.userId,
      maxAction: body.maxAction,
      maxPerBookingCents: body.maxPerBookingCents,
      maxTotalOpenCents: body.maxTotalOpenCents,
      maxDepositCents: body.maxDepositCents,
      allowedCategories: body.allowedCategories,
      allowedBookingModes: body.allowedBookingModes,
      allowedProviderSlugs: body.allowedProviderSlugs,
      allowedRiskClasses: body.allowedRiskClasses,
      excludedCatalogItemIds: body.excludedCatalogItemIds,
      allowNonRefundable: body.allowNonRefundable,
      allowHold: body.allowHold,
      allowRequestSubmission: body.allowRequestSubmission,
      allowInstantConfirmation: body.allowInstantConfirmation,
      expiresAt: body.expiresAt,
      isActive: body.isActive,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[AUTOBOOK POLICY PUT] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to save AutoBook policy.' }, { status: 500 })
  }
}
