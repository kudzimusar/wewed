import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import {
  listEngagementEvidence,
  uploadEngagementEvidence,
  VaultEvidenceError,
} from '@/lib/vault/engagement-evidence'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error

  try {
    const { id } = await params
    const data = await listEngagementEvidence(access.context.weddingId, id)
    return NextResponse.json({ success: true, count: data.length, data })
  } catch (error) {
    if (error instanceof VaultEvidenceError) {
      return NextResponse.json(
        { success: false, error: error.message, field: error.field },
        { status: error.status },
      )
    }
    console.error('[PLANNER ENGAGEMENT DOCUMENT GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service engagement documents' },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const form = await request.formData()
    const file = form.get('file')
    const linkRole = String(form.get('linkRole') ?? 'proof')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'A document is required.', field: 'file' },
        { status: 400 },
      )
    }

    const object = await uploadEngagementEvidence({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      engagementId: id,
      linkRole,
      file,
    })

    await logAuditEvent({
      action: 'service_engagement.document_uploaded',
      resourceType: 'VaultObject',
      resourceId: object.id,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: {
        engagementId: id,
        linkRole,
        mimeType: object.mimeType,
        byteSize: object.byteSize.toString(),
        checksumSha256: object.checksumSha256,
        storageState: object.storageState,
        scanState: object.scanState,
      },
    })

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
    if (error instanceof VaultEvidenceError) {
      return NextResponse.json(
        { success: false, error: error.message, field: error.field },
        { status: error.status },
      )
    }
    console.error('[PLANNER ENGAGEMENT DOCUMENT POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload service engagement document' },
      { status: 500 },
    )
  }
}
