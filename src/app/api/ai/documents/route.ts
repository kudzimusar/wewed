import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  createActionProposal,
  deleteAiDocument,
  deleteExpiredAiDocuments,
  ingestAiDocument,
  listAiDocuments,
  type AiDocumentValue,
} from '@/lib/ai/workspace-store'
import { searchAiDocuments } from '@/lib/ai/workspace-context'

const KINDS: AiDocumentValue['kind'][] = [
  'contract',
  'venue_manual',
  'proposal',
  'wedding_brief',
  'policy',
  'other',
]

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (query) {
      const data = await searchAiDocuments({
        weddingId: access.context.weddingId,
        query,
        includePrivate: true,
        limit: Number(request.nextUrl.searchParams.get('limit') || 6),
      })
      return NextResponse.json({ success: true, mode: 'search', data })
    }
    const data = await listAiDocuments(access.context.weddingId)
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

  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : 'ingest'

    if (action === 'ingest') {
      const title = typeof body.title === 'string' ? body.title : ''
      const text = typeof body.text === 'string' ? body.text : ''
      if (!title.trim() || !text.trim()) {
        return NextResponse.json(
          { success: false, error: 'Document title and extracted text are required.' },
          { status: 400 },
        )
      }
      const kind = KINDS.includes(body.kind as AiDocumentValue['kind'])
        ? (body.kind as AiDocumentValue['kind'])
        : 'other'
      const document = await ingestAiDocument({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        title,
        kind,
        sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : null,
        visibility: body.visibility === 'public' ? 'public' : 'private',
        retentionUntil:
          typeof body.retentionUntil === 'string' && body.retentionUntil.trim()
            ? body.retentionUntil
            : null,
        text,
      })
      return NextResponse.json({ success: true, data: document }, { status: 201 })
    }

    if (action === 'propose_publish') {
      const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : ''
      if (!documentId) {
        return NextResponse.json(
          { success: false, error: 'Document id is required.' },
          { status: 400 },
        )
      }
      const proposal = await createActionProposal({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        type: 'publish_guest_document',
        summary:
          'Publish this indexed document to the Guest Concierge retrieval boundary after human review.',
        payload: { documentId },
        preview: {
          documentId,
          effect: 'document chunks become eligible for public Guest Concierge retrieval',
        },
      })
      return NextResponse.json({ success: true, data: proposal }, { status: 201 })
    }

    if (action === 'delete_expired') {
      const data = await deleteExpiredAiDocuments({
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
    const message = error instanceof Error ? error.message : 'Unable to ingest AI document.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

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
    const data = await deleteAiDocument({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      documentId,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[AI DOCUMENTS DELETE] error:', error)
    const message = error instanceof Error ? error.message : 'Unable to delete AI document.'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
