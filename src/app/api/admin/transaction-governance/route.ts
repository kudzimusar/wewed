import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  AdminHistoricalEngagementAccessError,
  assertAdminHistoricalWeddingScope,
  listAdminHistoricalWeddings,
} from '@/lib/admin-historical-engagement'
import { requireWewedAdmin, WewedAdminAccessError } from '@/lib/wewed-admin'

function responseFor(error: unknown) {
  if (error instanceof WewedAdminAccessError || error instanceof AdminHistoricalEngagementAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  console.error('[ADMIN TRANSACTION GOVERNANCE] error:', error)
  return NextResponse.json({ success: false, error: 'Unable to load governed transaction support records.' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireWewedAdmin(request, 'admin.support.read')
    const weddings = await listAdminHistoricalWeddings(admin)
    const requestedWeddingId = request.nextUrl.searchParams.get('weddingId')?.trim() || weddings[0]?.id || ''
    if (!requestedWeddingId) {
      return NextResponse.json({
        success: true,
        admin: { userId: admin.session.userId, role: admin.adminRole },
        weddings: [],
        selectedWedding: null,
        engagements: [],
      })
    }
    const selectedWedding = await assertAdminHistoricalWeddingScope(admin, requestedWeddingId)
    const engagements = await db.serviceEngagement.findMany({
      where: { weddingId: selectedWedding.id },
      select: {
        id: true,
        origin: true,
        recordMode: true,
        lifecycleStatus: true,
        serviceCategory: true,
        serviceDescription: true,
        agreedAmount: true,
        currency: true,
        serviceDate: true,
        serviceLocation: true,
        createdAt: true,
        vendor: { select: { id: true, name: true, category: true } },
        contracts: {
          select: { id: true, contractNumber: true, status: true, currentVersionNumber: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return NextResponse.json({
      success: true,
      admin: { userId: admin.session.userId, role: admin.adminRole },
      weddings: weddings.map((item) => ({ ...item, date: item.date.toISOString() })),
      selectedWedding: { ...selectedWedding, date: selectedWedding.date.toISOString() },
      engagements: engagements.map((item) => ({
        ...item,
        agreedAmount: item.agreedAmount === null ? null : Number(item.agreedAmount),
        serviceDate: item.serviceDate?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    return responseFor(error)
  }
}
