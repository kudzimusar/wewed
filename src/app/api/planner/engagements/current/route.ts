import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import {
  createManagedServiceEngagement,
  listManagedServiceEngagements,
  Phase2ContractError,
} from '@/lib/contracts/phase2'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const vendorId = request.nextUrl.searchParams.get('vendorId')
    const data = await listManagedServiceEngagements(access.context.weddingId, vendorId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[PHASE2 MANAGED ENGAGEMENT GET] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load Wewed service engagements.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const created = await createManagedServiceEngagement({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      actorRole: access.context.role,
      body: await request.json(),
    })
    await logAuditEvent({
      action: 'service_engagement.managed_created',
      resourceType: 'ServiceEngagement',
      resourceId: created.id,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: {
        origin: created.origin,
        recordMode: created.recordMode,
        lifecycleStatus: created.lifecycleStatus,
        vendorId: created.vendorId,
        partyCount: created.parties.length,
        w ewedPlatformPartyCreated: false,
      },
    })
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    if (error instanceof Phase2ContractError) {
      return NextResponse.json({ success: false, error: error.message, field: error.field }, { status: error.status })
    }
    console.error('[PHASE2 MANAGED ENGAGEMENT POST] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create Wewed service engagement.' }, { status: 500 })
  }
}
