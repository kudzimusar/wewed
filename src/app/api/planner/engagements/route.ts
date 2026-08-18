import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import {
  createHistoricalEngagement,
  formatHistoricalEngagement,
  HistoricalEngagementConflictError,
  listHistoricalEngagements,
} from '@/lib/planner-engagement-route-core'
import {
  HistoricalEngagementInputError,
  normalizeHistoricalEngagementInput,
} from '@/lib/planner-historical-engagement'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error

  try {
    const engagements = await listHistoricalEngagements(access.context.weddingId)
    return NextResponse.json({
      success: true,
      count: engagements.length,
      data: engagements.map(formatHistoricalEngagement),
    })
  } catch (error) {
    console.error('[PLANNER ENGAGEMENTS GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service engagements' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error

  try {
    const input = normalizeHistoricalEngagementInput(await request.json())
    const created = await createHistoricalEngagement({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      input,
    })

    await logAuditEvent({
      action: 'historical_engagement.created',
      resourceType: 'ServiceEngagement',
      resourceId: created.id,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: {
        origin: created.origin,
        recordMode: created.recordMode,
        vendorId: created.vendorId,
        serviceCategory: created.serviceCategory,
        agreedAmount: created.agreedAmount?.toString() ?? null,
        currency: created.currency,
        paymentCount: created.payments.length,
        budgetItemIds: created.budgetItems.map((item) => item.id),
        externalAgreementStatus: created.externalAgreementStatus,
      },
    })

    return NextResponse.json(
      { success: true, data: formatHistoricalEngagement(created) },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof HistoricalEngagementInputError) {
      return NextResponse.json(
        { success: false, error: error.message, field: error.field },
        { status: 400 },
      )
    }
    if (error instanceof HistoricalEngagementConflictError) {
      return NextResponse.json(
        { success: false, error: error.message, field: error.field },
        { status: error.status },
      )
    }
    console.error('[PLANNER ENGAGEMENTS POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create historical engagement' },
      { status: 500 },
    )
  }
}
