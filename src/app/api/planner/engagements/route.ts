import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import { db } from '@/lib/db'
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
    const engagementIds = engagements.map((engagement) => engagement.id)
    const links = engagementIds.length
      ? await db.vaultLink.findMany({
          where: {
            weddingId: access.context.weddingId,
            entityType: 'service_engagement',
            entityId: { in: engagementIds },
            vaultObject: { deletedAt: null },
          },
          include: { vaultObject: true },
          orderBy: { createdAt: 'desc' },
        })
      : []
    const evidenceByEngagement = new Map<string, Array<{
      id: string
      linkRole: string
      displayName: string
      originalFilename: string
      mimeType: string
      byteSize: number
      checksumSha256: string
      storageState: string
      scanState: string
      createdAt: string
    }>>()
    for (const link of links) {
      const evidence = evidenceByEngagement.get(link.entityId) ?? []
      evidence.push({
        id: link.vaultObject.id,
        linkRole: link.linkRole,
        displayName: link.vaultObject.displayName,
        originalFilename: link.vaultObject.originalFilename,
        mimeType: link.vaultObject.mimeType,
        byteSize: Number(link.vaultObject.byteSize),
        checksumSha256: link.vaultObject.checksumSha256,
        storageState: link.vaultObject.storageState,
        scanState: link.vaultObject.scanState,
        createdAt: link.vaultObject.createdAt.toISOString(),
      })
      evidenceByEngagement.set(link.entityId, evidence)
    }

    return NextResponse.json({
      success: true,
      count: engagements.length,
      data: engagements.map((engagement) => ({
        ...formatHistoricalEngagement(engagement),
        evidence: evidenceByEngagement.get(engagement.id) ?? [],
      })),
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
      { success: true, data: { ...formatHistoricalEngagement(created), evidence: [] } },
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
