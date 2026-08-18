import { NextRequest, NextResponse } from 'next/server'
import {
  AdminHistoricalEngagementAccessError,
  assertAdminHistoricalWeddingScope,
} from '@/lib/admin-historical-engagement'
import { logAuditEvent } from '@/lib/audit'
import {
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
} from '@/lib/wewed-admin'
import {
  uploadEngagementEvidence,
  VaultEvidenceError,
} from '@/lib/vault/engagement-evidence'

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  if (error instanceof AdminHistoricalEngagementAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  if (error instanceof VaultEvidenceError) {
    return NextResponse.json(
      { success: false, error: error.message, field: error.field },
      { status: error.status },
    )
  }
  console.error('[ADMIN SERVICE ENGAGEMENT EVIDENCE] error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to upload service-record evidence.' },
    { status: 500 },
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireWewedAdmin(request, 'admin.support.manage')
    const { id } = await params
    const form = await request.formData()
    const weddingId = String(form.get('weddingId') ?? '').trim()
    await assertAdminHistoricalWeddingScope(context, weddingId)

    const file = form.get('file')
    const linkRole = String(form.get('linkRole') ?? 'proof')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'A proof document is required.', field: 'file' },
        { status: 400 },
      )
    }

    const object = await uploadEngagementEvidence({
      weddingId,
      actorId: context.session.userId,
      engagementId: id,
      linkRole,
      file,
    })

    const auditFacts = {
      weddingId,
      engagementId: id,
      linkRole,
      mimeType: object.mimeType,
      byteSize: object.byteSize.toString(),
      checksumSha256: object.checksumSha256,
      storageState: object.storageState,
      scanState: object.scanState,
    }

    await Promise.all([
      logAuditEvent({
        action: 'historical_engagement.admin_evidence_uploaded',
        resourceType: 'VaultObject',
        resourceId: object.id,
        weddingId,
        actorId: context.session.userId,
        afterValue: auditFacts,
      }),
      writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'historical_engagement.evidence_uploaded',
        resourceType: 'VaultObject',
        resourceId: object.id,
        details: auditFacts,
      }),
    ])

    return NextResponse.json(
      {
        success: true,
        data: {
          id: object.id,
          displayName: object.displayName,
          originalFilename: object.originalFilename,
          mimeType: object.mimeType,
          byteSize: Number(object.byteSize),
          checksumSha256: object.checksumSha256,
          storageState: object.storageState,
          scanState: object.scanState,
          publicationState: object.publicationState,
          createdAt: object.createdAt.toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
