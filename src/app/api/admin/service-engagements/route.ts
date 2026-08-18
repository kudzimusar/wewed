import { NextRequest, NextResponse } from 'next/server'
import {
  AdminHistoricalEngagementAccessError,
  assertAdminHistoricalWeddingScope,
  listAdminHistoricalWeddings,
} from '@/lib/admin-historical-engagement'
import { logAuditEvent } from '@/lib/audit'
import { db } from '@/lib/db'
import {
  createHistoricalEngagement,
  formatHistoricalEngagement,
  HistoricalEngagementConflictError,
  listHistoricalEngagements,
} from '@/lib/planner-engagement-route-core'
import { calculatePaidVendorRescue } from '@/lib/planner-engagement-rescue'
import {
  HistoricalEngagementInputError,
  normalizeHistoricalEngagementInput,
} from '@/lib/planner-historical-engagement'
import {
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
} from '@/lib/wewed-admin'

function canManage(context: { permissions: string[] }): boolean {
  return context.permissions.includes('*') || context.permissions.includes('admin.support.manage')
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  if (error instanceof AdminHistoricalEngagementAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
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
  console.error('[ADMIN SERVICE ENGAGEMENTS] error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to load historical service records.' },
    { status: 500 },
  )
}

async function evidenceMap(weddingId: string, engagementIds: string[]) {
  const links = engagementIds.length
    ? await db.vaultLink.findMany({
        where: {
          weddingId,
          entityType: 'service_engagement',
          entityId: { in: engagementIds },
          vaultObject: { deletedAt: null },
        },
        include: { vaultObject: true },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const result = new Map<string, Array<{
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
    const current = result.get(link.entityId) ?? []
    current.push({
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
    result.set(link.entityId, current)
  }
  return result
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.support.read')
    const weddings = await listAdminHistoricalWeddings(context)
    const weddingId = request.nextUrl.searchParams.get('weddingId')?.trim() || ''

    if (!weddingId) {
      return NextResponse.json({
        success: true,
        admin: {
          userId: context.session.userId,
          role: context.adminRole,
          canManage: canManage(context),
        },
        weddings: weddings.map((wedding) => ({
          ...wedding,
          date: wedding.date.toISOString(),
        })),
        selectedWedding: null,
        vendors: [],
        budgetItems: [],
        engagements: [],
        rescue: { count: 0, summary: { paidVendors: 0, missingEngagement: 0, missingProof: 0, mismatchedAmount: 0 }, data: [] },
      })
    }

    const selectedWedding = await assertAdminHistoricalWeddingScope(context, weddingId)
    const [vendors, budgetItems, engagements, rescue] = await Promise.all([
      db.vendor.findMany({
        where: { weddingId },
        select: { id: true, name: true, category: true, paymentStatus: true },
        orderBy: [{ name: 'asc' }],
      }),
      db.budgetItem.findMany({
        where: { weddingId },
        select: {
          id: true,
          description: true,
          estimatedCost: true,
          actualCost: true,
          paidAmount: true,
          currency: true,
          vendorId: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
      listHistoricalEngagements(weddingId),
      calculatePaidVendorRescue(weddingId),
    ])
    const evidence = await evidenceMap(weddingId, engagements.map((item) => item.id))

    return NextResponse.json({
      success: true,
      admin: {
        userId: context.session.userId,
        role: context.adminRole,
        canManage: canManage(context),
      },
      weddings: weddings.map((wedding) => ({ ...wedding, date: wedding.date.toISOString() })),
      selectedWedding: { ...selectedWedding, date: selectedWedding.date.toISOString() },
      vendors,
      budgetItems,
      engagements: engagements.map((engagement) => ({
        ...formatHistoricalEngagement(engagement),
        evidence: evidence.get(engagement.id) ?? [],
      })),
      rescue,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.support.manage')
    const body = (await request.json()) as Record<string, unknown>
    const weddingId = typeof body.weddingId === 'string' ? body.weddingId.trim() : ''
    await assertAdminHistoricalWeddingScope(context, weddingId)

    const { weddingId: _ignoredWeddingId, ...record } = body
    const input = normalizeHistoricalEngagementInput(record)
    const created = await createHistoricalEngagement({
      weddingId,
      actorId: context.session.userId,
      input,
    })

    const auditFacts = {
      origin: created.origin,
      recordMode: created.recordMode,
      weddingId,
      vendorId: created.vendorId,
      serviceCategory: created.serviceCategory,
      agreedAmount: created.agreedAmount?.toString() ?? null,
      currency: created.currency,
      paymentCount: created.payments.length,
      budgetItemIds: created.budgetItems.map((item) => item.id),
      externalAgreementStatus: created.externalAgreementStatus,
    }

    await Promise.all([
      logAuditEvent({
        action: 'historical_engagement.admin_created',
        resourceType: 'ServiceEngagement',
        resourceId: created.id,
        weddingId,
        actorId: context.session.userId,
        afterValue: auditFacts,
      }),
      writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'historical_engagement.created',
        resourceType: 'ServiceEngagement',
        resourceId: created.id,
        details: auditFacts,
      }),
    ])

    return NextResponse.json(
      { success: true, data: { ...formatHistoricalEngagement(created), evidence: [] } },
      { status: 201 },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
