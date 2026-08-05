import { createHash, randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import {
  chunkCanonicalDocument,
  normalizeDocumentText,
  reconstructCanonicalDocument,
} from '@/lib/ai/remediation'
import { AI_SECTIONS } from '@/lib/ai/workspace-store'

export type AiDocumentKind =
  | 'contract'
  | 'venue_manual'
  | 'proposal'
  | 'wedding_brief'
  | 'policy'
  | 'other'

export interface SecureAiDocumentValue {
  schemaVersion: 2
  documentId: string
  title: string
  kind: AiDocumentKind
  sourceUrl: string | null
  visibility: 'private' | 'public'
  retentionUntil: string | null
  checksum: string
  chunkCount: number
  indexedAt: string
  createdAt: string
  sourceText: string
}

export interface AiDocumentSummary {
  id: string
  documentId: string
  title: string
  kind: AiDocumentKind
  sourceUrl: string | null
  visibility: 'private' | 'public'
  retentionUntil: string | null
  checksum: string
  chunkCount: number
  indexedAt: string
  createdAt: string
  updatedAt: string
}

interface LegacyDocumentValue {
  schemaVersion?: number
  documentId: string
  title: string
  kind?: AiDocumentKind
  sourceUrl?: string | null
  visibility?: 'private' | 'public'
  retentionUntil?: string | null
  checksum?: string
  chunkCount?: number
  indexedAt?: string
  createdAt?: string
  sourceText?: string
}

interface ChunkValue {
  text?: unknown
}

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T
}

function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function validRetentionDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid document retention date.')
  }
  return date.toISOString()
}

function checksum(sourceText: string): string {
  return createHash('sha256').update(sourceText).digest('hex')
}

function summary(
  row: { id: string; updatedAt: Date },
  value: SecureAiDocumentValue,
): AiDocumentSummary {
  return {
    id: row.id,
    documentId: value.documentId,
    title: value.title,
    kind: value.kind,
    sourceUrl: value.sourceUrl,
    visibility: value.visibility,
    retentionUntil: value.retentionUntil,
    checksum: value.checksum,
    chunkCount: value.chunkCount,
    indexedAt: value.indexedAt,
    createdAt: value.createdAt,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function normalizeStoredDocument(
  raw: LegacyDocumentValue,
  sourceText: string,
): SecureAiDocumentValue {
  const normalized = normalizeDocumentText(sourceText)
  const now = new Date().toISOString()
  return {
    schemaVersion: 2,
    documentId: raw.documentId,
    title: clean(raw.title, 240) || 'Untitled document',
    kind: raw.kind ?? 'other',
    sourceUrl: raw.sourceUrl ? clean(raw.sourceUrl, 1_000) : null,
    visibility: raw.visibility === 'public' ? 'public' : 'private',
    retentionUntil: raw.retentionUntil ?? null,
    checksum: checksum(normalized),
    chunkCount: chunkCanonicalDocument(normalized).length,
    indexedAt: raw.indexedAt ?? now,
    createdAt: raw.createdAt ?? now,
    sourceText: normalized,
  }
}

async function writeChunks(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  input: {
    weddingId: string
    document: SecureAiDocumentValue
    chunks: string[]
  },
): Promise<void> {
  for (let index = 0; index < input.chunks.length; index += 1) {
    await tx.weddingContent.create({
      data: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.documentChunk,
        field: `${input.document.documentId}:${String(index).padStart(4, '0')}`,
        value: JSON.stringify({
          documentId: input.document.documentId,
          title: input.document.title,
          text: input.chunks[index],
          sourceUrl: input.document.sourceUrl,
          visibility: input.document.visibility,
          chunkIndex: index,
          checksum: input.document.checksum,
        }),
        order: index,
        metadata: JSON.stringify({
          visibility: input.document.visibility,
          published: input.document.visibility === 'public',
        }),
      },
    })
  }
}

export async function ingestSecureAiDocument(input: {
  weddingId: string
  actorId: string
  title: string
  kind?: AiDocumentKind
  sourceUrl?: string | null
  retentionUntil?: string | null
  text: string
}): Promise<AiDocumentSummary> {
  const sourceText = normalizeDocumentText(input.text)
  if (sourceText.length < 20) {
    throw new Error('Document text is too short to index.')
  }

  const chunks = chunkCanonicalDocument(sourceText)
  if (chunks.length === 0) throw new Error('Document text could not be indexed.')

  const now = new Date().toISOString()
  const documentId = `aidoc_${randomUUID().replace(/-/g, '')}`
  const value: SecureAiDocumentValue = {
    schemaVersion: 2,
    documentId,
    title: clean(input.title, 240) || 'Untitled document',
    kind: input.kind ?? 'other',
    sourceUrl: input.sourceUrl ? clean(input.sourceUrl, 1_000) : null,
    visibility: 'private',
    retentionUntil: validRetentionDate(input.retentionUntil),
    checksum: checksum(sourceText),
    chunkCount: chunks.length,
    indexedAt: now,
    createdAt: now,
    sourceText,
  }

  const row = await db.$transaction(async (tx) => {
    const created = await tx.weddingContent.create({
      data: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.document,
        field: documentId,
        value: JSON.stringify(value),
        metadata: JSON.stringify({ visibility: 'private', published: false }),
      },
    })
    await writeChunks(tx, {
      weddingId: input.weddingId,
      document: value,
      chunks,
    })
    await tx.auditEvent.create({
      data: {
        action: 'ai.document.ingest',
        resourceType: AI_SECTIONS.document,
        resourceId: documentId,
        afterValue: JSON.stringify({
          ...value,
          sourceText: `[redacted canonical source: ${sourceText.length} characters]`,
        }),
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return created
  })

  return summary(row, value)
}

export async function listSecureAiDocuments(
  weddingId: string,
): Promise<AiDocumentSummary[]> {
  const rows = await db.weddingContent.findMany({
    where: { weddingId, section: AI_SECTIONS.document },
    orderBy: { updatedAt: 'desc' },
  })

  return rows.flatMap((row) => {
    try {
      const raw = parse<LegacyDocumentValue>(row.value)
      const value = normalizeStoredDocument(raw, raw.sourceText ?? '')
      return [summary(row, value)]
    } catch {
      return []
    }
  })
}

async function canonicalSourceForDocument(input: {
  weddingId: string
  documentId: string
  raw: LegacyDocumentValue
}): Promise<string> {
  if (input.raw.sourceText) return normalizeDocumentText(input.raw.sourceText)

  const chunks = await db.weddingContent.findMany({
    where: {
      weddingId: input.weddingId,
      section: AI_SECTIONS.documentChunk,
      field: { startsWith: `${input.documentId}:` },
    },
    orderBy: { order: 'asc' },
    select: { value: true },
  })
  return reconstructCanonicalDocument(
    chunks.flatMap((chunk) => {
      try {
        const value = parse<ChunkValue>(chunk.value)
        return typeof value.text === 'string' ? [value.text] : []
      } catch {
        return []
      }
    }),
  )
}

export async function reindexSecureAiDocument(input: {
  weddingId: string
  actorId: string
  documentId: string
}): Promise<AiDocumentSummary> {
  const row = await db.weddingContent.findFirst({
    where: {
      weddingId: input.weddingId,
      section: AI_SECTIONS.document,
      field: input.documentId,
    },
  })
  if (!row) throw new Error('AI document not found.')

  const raw = parse<LegacyDocumentValue>(row.value)
  const sourceText = await canonicalSourceForDocument({
    weddingId: input.weddingId,
    documentId: input.documentId,
    raw,
  })
  if (sourceText.length < 20) {
    throw new Error('The canonical document source is unavailable.')
  }

  const chunks = chunkCanonicalDocument(sourceText)
  const indexedAt = new Date().toISOString()
  const value: SecureAiDocumentValue = {
    ...normalizeStoredDocument(raw, sourceText),
    indexedAt,
    checksum: checksum(sourceText),
    chunkCount: chunks.length,
    sourceText,
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.weddingId}:${input.documentId}`}))`
    await tx.weddingContent.deleteMany({
      where: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.documentChunk,
        field: { startsWith: `${input.documentId}:` },
      },
    })
    await writeChunks(tx, {
      weddingId: input.weddingId,
      document: value,
      chunks,
    })
    const document = await tx.weddingContent.update({
      where: { id: row.id },
      data: {
        value: JSON.stringify(value),
        metadata: JSON.stringify({
          visibility: value.visibility,
          published: value.visibility === 'public',
        }),
      },
    })
    await tx.auditEvent.create({
      data: {
        action: 'ai.document.reindex',
        resourceType: AI_SECTIONS.document,
        resourceId: input.documentId,
        beforeValue: JSON.stringify({ checksum: raw.checksum, chunkCount: raw.chunkCount }),
        afterValue: JSON.stringify({ checksum: value.checksum, chunkCount: value.chunkCount }),
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return document
  })

  return summary(updated, value)
}

export async function deleteSecureAiDocument(input: {
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

  const deleted = await db.$transaction(async (tx) => {
    const chunks = await tx.weddingContent.count({
      where: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.documentChunk,
        field: { startsWith: `${input.documentId}:` },
      },
    })
    await tx.weddingContent.deleteMany({
      where: {
        weddingId: input.weddingId,
        OR: [
          { id: document.id },
          {
            section: AI_SECTIONS.documentChunk,
            field: { startsWith: `${input.documentId}:` },
          },
        ],
      },
    })
    await tx.auditEvent.create({
      data: {
        action: 'ai.document.delete',
        resourceType: AI_SECTIONS.document,
        resourceId: input.documentId,
        beforeValue: JSON.stringify({ documentId: input.documentId }),
        afterValue: JSON.stringify({ deletedChunks: chunks }),
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return chunks
  })

  return { documentId: input.documentId, deletedChunks: deleted }
}

export async function deleteExpiredSecureAiDocuments(input: {
  weddingId: string
  actorId: string
}) {
  const documents = await listSecureAiDocuments(input.weddingId)
  const expired = documents.filter(
    (document) =>
      document.retentionUntil !== null &&
      new Date(document.retentionUntil).getTime() <= Date.now(),
  )
  const results = []
  for (const document of expired) {
    results.push(
      await deleteSecureAiDocument({
        weddingId: input.weddingId,
        actorId: input.actorId,
        documentId: document.documentId,
      }),
    )
  }
  return results
}
