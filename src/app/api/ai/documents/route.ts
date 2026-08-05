import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  AI_SECTIONS,
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

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T
}

function cleanText(value: unknown, max = 200_000): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function chunkText(text: string, max = 1_600, overlap = 180): string[] {
  const normalized = cleanText(text)
  if (!normalized) return []
  const chunks: string[] = []
  let start = 0
  while (start < normalized.length && chunks.length < 150) {
    let end = Math.min(normalized.length, start + max)
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(' ', end)
      if (boundary > start + Math.floor(max * 0.6)) end = boundary
    }
    chunks.push(normalized.slice(start, end).trim())
    if (end >= normalized.length) break
    start = Math.max(start + 1, end - overlap)
  }
  return chunks.filter(Boolean)
}

async function reindexDocument(input: {
  weddingId: string
  actorId: string
  documentId: string
}) {
  const document = await db.weddingContent.findFirst({
    where: {
      weddingId: input.weddingId,
      section: AI_SECTIONS.document,
      field: input.documentId,
    },
  })
  if (!document) throw new Error('AI document not found.')
  const metadata = parse<AiDocumentValue>(document.value)
  const existingChunks = await db.weddingContent.findMany({
    where: {
      weddingId: input.weddingId,
      section: AI_SECTIONS.documentChunk,
      field: { startsWith: `${input.documentId}:` },
    },
    orderBy: { order: 'asc' },
  })
  if (existingChunks.length === 0) {
    throw new Error('Document has no indexed chunks to rebuild.')
  }

  const sourceText = existingChunks
    .flatMap((chunk) => {
      try {
        const value = parse<{ text?: unknown }>(chunk.value)
        return value.text ? [String(value.text)] : []
      } catch {
        return []
      }
    })
    .join('\n')
  const chunks = chunkText(sourceText)
  if (chunks.length === 0) throw new Error('Document text could not be reconstructed.')

  const checksum = createHash('sha256').update(cleanText(sourceText)).digest('hex')
  const indexedAt = new Date().toISOString()
  const nextMetadata: AiDocumentValue = {
    ...metadata,
    checksum,
    chunkCount: chunks.length,
    indexedAt,
  }

  await db.$transaction(async (tx) => {
    await tx.weddingContent.deleteMany({
      where: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.documentChunk,
        field: { startsWith: `${input.documentId}:` },
      },
    })
    for (let index = 0; index < chunks.length; index += 1) {
      await tx.weddingContent.create({
        data: {
          weddingId: input.weddingId,
          section: AI_SECTIONS.documentChunk,
          field: `${input.documentId}:${String(index).padStart(4, '0')}`,
          value: JSON.stringify({
            documentId: input.documentId,
            title: metadata.title,
            text: chunks[index],
            sourceUrl: metadata.sourceUrl,
            visibility: metadata.visibility,
            chunkIndex: index,
            checksum,
          }),
          order: index,
          metadata: JSON.stringify({
            visibility: metadata.visibility,
            published: metadata.visibility === 'public',
          }),
        },
      })
    }
    await tx.weddingContent.update({
      where: { id: document.id },
      data: { value: JSON.stringify(nextMetadata) },
    })
  })

  await db.auditEvent.create({
    data: {
      action: 'ai.document.reindex',
      resourceType: AI_SECTIONS.document,
      resourceId: input.documentId,
      beforeValue: document.value,
      afterValue: JSON.stringify(nextMetadata),
      weddingId: input.weddingId,
      actorId: input.actorId,
    },
  })

  return nextMetadata
}

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

    if (action === 'reindex') {
      const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : ''
      if (!documentId) {
        return NextResponse.json(
          { success: false, error: 'Document id is required.' },
          { status: 400 },
        )
      }
      const document = await reindexDocument({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        documentId,
      })
      return NextResponse.json({ success: true, data: document })
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
    const message = error instanceof Error ? error.message : 'Unable to update AI document.'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
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
