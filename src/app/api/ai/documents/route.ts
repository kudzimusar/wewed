import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { blockUnsafeAiPreviewWrite } from '@/lib/ai/route-safety'
import {
  deleteExpiredSecureAiDocuments,
  deleteSecureAiDocument,
  ingestSecureAiDocument,
  listSecureAiDocuments,
  reindexSecureAiDocument,
  type AiDocumentKind,
} from '@/lib/ai/document-store'
import {
  AI_SECTIONS,
  createActionProposal,
} from '@/lib/ai/workspace-store'
import { searchAiDocuments } from '@/lib/ai/workspace-context'

const KINDS: readonly AiDocumentKind[] = [
  'contract',
  'venue_manual',
  'proposal',
  'wedding_brief',
  'policy',
  'other',
]

function errorStatus(message: string): number {
  if (message.includes('not found')) return 404
  if (message.includes('Invalid') || message.includes('required')) return 400
  if (message.includes('too short') || message.includes('unavailable')) return 422
  return 500
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (query) {
      const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || 6)
      const data = await searchAiDocuments({
        weddingId: access.context.weddingId,
        query,
        includePrivate: true,
        limit: Number.isFinite(requestedLimit) ? requestedLimit : 6,
      })
      return NextResponse.json({ success: true, mode: 'search', data })
    }

    const data = await listSecureAiDocuments(access.context.weddingId)
    return NextResponse.json({ success: true, mode: 'list', data })
  } catch (error) {
    console.error('[AI DOCUMENTS GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load AI documents.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error
  const previewBlock = blockUnsafeAiPreviewWrite(
    request,
    access.context.weddingId,
  )
  if (previewBlock) return previewBlock

  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : 'ingest'

    if (action === 'ingest') {
      const title = typeof body.title === 'string' ? body.title : ''
      const text = typeof body.text === 'string' ? body.text : ''
      if (!title.trim() || !text.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: 'Document title and extracted text are required.',
          },
          { status: 400 },
        )
      }
      if (body.visibility === 'public') {
        return NextResponse.json(
          {
            success: false,
            code: 'PUBLIC_INGEST_BLOCKED',
            error:
              'Documents must be indexed privately and published only through an approved action proposal.',
          },
          { status: 409 },
        )
      }

      const kind = KINDS.includes(body.kind as AiDocumentKind)
        ? (body.kind as AiDocumentKind)
        : 'other'
      const document = await ingestSecureAiDocument({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        title,
        kind,
        sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : null,
        retentionUntil:
          typeof body.retentionUntil === 'string' && body.retentionUntil.trim()
            ? body.retentionUntil
            : null,
        text,
      })
      return NextResponse.json(
        {
          success: true,
          data: document,
          boundary: 'private until approved publication',
        },
        { status: 201 },
      )
    }

    if (action === 'reindex') {
      const documentId =
        typeof body.documentId === 'string' ? body.documentId.trim() : ''
      if (!documentId) {
        return NextResponse.json(
          { success: false, error: 'Document id is required.' },
          { status: 400 },
        )
      }
      const document = await reindexSecureAiDocument({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        documentId,
      })
      return NextResponse.json({ success: true, data: document })
    }

    if (action === 'propose_publish') {
      const documentId =
        typeof body.documentId === 'string' ? body.documentId.trim() : ''
      if (!documentId) {
        return NextResponse.json(
          { success: false, error: 'Document id is required.' },
          { status: 400 },
        )
      }

      const document = await db.weddingContent.findFirst({
        where: {
          weddingId: access.context.weddingId,
          section: AI_SECTIONS.document,
          field: documentId,
        },
        select: { value: true },
      })
      if (!document) {
        return NextResponse.json(
          { success: false, error: 'AI document not found.' },
          { status: 404 },
        )
      }
      const value = JSON.parse(document.value) as {
        title?: string
        visibility?: string
      }
      if (value.visibility === 'public') {
        return NextResponse.json(
          { success: false, error: 'Document is already public.' },
          { status: 409 },
        )
      }

      const existing = await db.contentRevision.findFirst({
        where: {
          weddingId: access.context.weddingId,
          section: AI_SECTIONS.proposal,
          status: { in: ['proposed', 'approved', 'executing'] },
          value: { contains: documentId },
        },
        select: { id: true, status: true },
      })
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: `A publication proposal already exists in ${existing.status} state.`,
            proposalId: existing.id,
          },
          { status: 409 },
        )
      }

      const proposal = await createActionProposal({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        type: 'publish_guest_document',
        summary: `Publish “${value.title || 'indexed document'}” to the Guest Concierge after human review.`,
        payload: { documentId },
        preview: {
          documentId,
          currentVisibility: 'private',
          nextVisibility: 'public',
          effect:
            'document chunks become eligible for public Guest Concierge retrieval',
        },
      })
      return NextResponse.json({ success: true, data: proposal }, { status: 201 })
    }

    if (action === 'delete_expired') {
      const data = await deleteExpiredSecureAiDocuments({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      })
      return NextResponse.json({ success: true, data })
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported document action.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[AI DOCUMENTS POST] error:', error)
    const message =
      error instanceof Error ? error.message : 'Unable to update AI document.'
    return NextResponse.json(
      { success: false, error: message },
      { status: errorStatus(message) },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error
  const previewBlock = blockUnsafeAiPreviewWrite(
    request,
    access.context.weddingId,
  )
  if (previewBlock) return previewBlock

  try {
    const body = (await request.json()) as { documentId?: unknown }
    const documentId =
      typeof body.documentId === 'string' ? body.documentId.trim() : ''
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document id is required.' },
        { status: 400 },
      )
    }
    const data = await deleteSecureAiDocument({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      documentId,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[AI DOCUMENTS DELETE] error:', error)
    const message =
      error instanceof Error ? error.message : 'Unable to delete AI document.'
    return NextResponse.json(
      { success: false, error: message },
      { status: errorStatus(message) },
    )
  }
}
