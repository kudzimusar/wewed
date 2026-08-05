import { createHash, randomUUID } from 'node:crypto'
import { db } from '@/lib/db'

export const AI_SECTIONS = {
  template: 'ai_template_version',
  draft: 'ai_communication_draft',
  proposal: 'ai_action_proposal',
  document: 'ai_document',
  documentChunk: 'ai_document_chunk',
} as const

export type AiCommunicationStatus =
  | 'draft'
  | 'approved'
  | 'ready_to_send'
  | 'sent'
  | 'archived'

export type AiProposalStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed'

export type AiProposalType =
  | 'apply_template'
  | 'approve_communication'
  | 'create_reminder'
  | 'publish_guest_document'

export interface AiTemplateItem {
  type: 'task' | 'timeline' | 'reminder'
  title: string
  description?: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  offsetDays?: number
  assignee?: string
  time?: string
  duration?: string
  location?: string
  subject?: string
  body?: string
  audience?: 'all' | 'pending' | 'attending' | 'declined'
}

export interface AiTemplateVersionValue {
  schemaVersion: 1
  templateId: string
  version: number
  name: string
  description: string
  content: string
  items: AiTemplateItem[]
  anonymized: boolean
  createdFrom: 'ai' | 'manual' | 'completed_wedding'
  createdAt: string
}

export interface AiCommunicationDraftValue {
  schemaVersion: 1
  draftId: string
  title: string
  audience: string
  channel: 'email' | 'whatsapp' | 'sms' | 'internal' | 'speech'
  subject: string | null
  body: string
  sourceArea: 'communication_assistant'
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  sentAt: string | null
}

export interface AiActionProposalValue {
  schemaVersion: 1
  proposalId: string
  type: AiProposalType
  summary: string
  payload: Record<string, unknown>
  preview: Record<string, unknown>
  createdAt: string
  approvedAt: string | null
  rejectedAt: string | null
  executedAt: string | null
  failure: string | null
}

export interface AiDocumentValue {
  schemaVersion: 1
  documentId: string
  title: string
  kind: 'contract' | 'venue_manual' | 'proposal' | 'wedding_brief' | 'policy' | 'other'
  sourceUrl: string | null
  visibility: 'private' | 'public'
  retentionUntil: string | null
  checksum: string
  chunkCount: number
  indexedAt: string
  createdAt: string
}

interface RevisionRow {
  id: string
  fieldKey: string
  value: string
  status: string
  weddingId: string
  authorId: string | null
  publishedAt: Date | null
  scheduledFor: Date | null
  createdAt: Date
  updatedAt: Date
}

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T
}

function clean(value: unknown, max = 20_000): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
}

function revisionResponse<T>(row: RevisionRow, value: T) {
  return {
    id: row.id,
    key: row.fieldKey,
    status: row.status,
    weddingId: row.weddingId,
    authorId: row.authorId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    value,
  }
}

export function extractTemplateItems(content: string): AiTemplateItem[] {
  const blocks = [content]
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/gi) ?? []
  for (const block of fenced) {
    blocks.unshift(block.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim())
  }

  for (const candidate of blocks) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      const array = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
          ? (parsed as { items: unknown[] }).items
          : null
      if (!array) continue

      const items = array.flatMap((raw): AiTemplateItem[] => {
        if (!raw || typeof raw !== 'object') return []
        const item = raw as Record<string, unknown>
        const type = item.type
        const title = clean(item.title, 240)
        if (!title || !['task', 'timeline', 'reminder'].includes(String(type))) return []
        const output: AiTemplateItem = {
          type: type as AiTemplateItem['type'],
          title,
        }
        if (item.description) output.description = clean(item.description, 2_000)
        if (item.category) output.category = clean(item.category, 80)
        if (['low', 'medium', 'high'].includes(String(item.priority))) {
          output.priority = item.priority as AiTemplateItem['priority']
        }
        if (typeof item.offsetDays === 'number' && Number.isFinite(item.offsetDays)) {
          output.offsetDays = Math.max(-730, Math.min(365, Math.round(item.offsetDays)))
        }
        if (item.assignee) output.assignee = clean(item.assignee, 160)
        if (item.time) output.time = clean(item.time, 20)
        if (item.duration) output.duration = clean(item.duration, 80)
        if (item.location) output.location = clean(item.location, 200)
        if (item.subject) output.subject = clean(item.subject, 300)
        if (item.body) output.body = clean(item.body, 8_000)
        if (['all', 'pending', 'attending', 'declined'].includes(String(item.audience))) {
          output.audience = item.audience as AiTemplateItem['audience']
        }
        return [output]
      })
      if (items.length > 0) return items.slice(0, 250)
    } catch {
      // Try the next representation.
    }
  }

  return []
}

export async function listAiTemplates(weddingId: string) {
  const rows = await db.contentRevision.findMany({
    where: { weddingId, section: AI_SECTIONS.template, status: { not: 'archived' } },
    orderBy: [{ fieldKey: 'asc' }, { createdAt: 'desc' }],
  })
  const versions = rows.flatMap((row) => {
    try {
      return [revisionResponse(row, parse<AiTemplateVersionValue>(row.value))]
    } catch {
      return []
    }
  })
  const latest = new Map<string, (typeof versions)[number]>()
  for (const version of versions) {
    const id = version.value.templateId
    if (!latest.has(id)) latest.set(id, version)
  }
  return { latest: [...latest.values()], versions }
}

export async function createAiTemplateVersion(input: {
  weddingId: string
  authorId: string
  templateId?: string
  name: string
  description?: string
  content: string
  anonymized?: boolean
  createdFrom?: AiTemplateVersionValue['createdFrom']
}) {
  const templateId = clean(input.templateId, 100) || `aitpl_${randomUUID().replace(/-/g, '')}`
  const previous = await db.contentRevision.findFirst({
    where: { weddingId: input.weddingId, section: AI_SECTIONS.template, fieldKey: templateId },
    orderBy: { createdAt: 'desc' },
  })
  const previousValue = previous
    ? (() => {
        try {
          return parse<AiTemplateVersionValue>(previous.value)
        } catch {
          return null
        }
      })()
    : null

  const now = new Date().toISOString()
  const value: AiTemplateVersionValue = {
    schemaVersion: 1,
    templateId,
    version: (previousValue?.version ?? 0) + 1,
    name: clean(input.name, 180) || 'Untitled AI template',
    description: clean(input.description, 1_500),
    content: clean(input.content, 60_000),
    items: extractTemplateItems(input.content),
    anonymized: input.anonymized !== false,
    createdFrom: input.createdFrom ?? 'ai',
    createdAt: now,
  }

  const row = await db.contentRevision.create({
    data: {
      section: AI_SECTIONS.template,
      fieldKey: templateId,
      value: JSON.stringify(value),
      status: 'draft',
      previousValue: previous?.value ?? null,
      weddingId: input.weddingId,
      authorId: input.authorId,
    },
  })

  await db.auditEvent.create({
    data: {
      action: 'ai.template.version.create',
      resourceType: AI_SECTIONS.template,
      resourceId: row.id,
      beforeValue: previous?.value ?? null,
      afterValue: row.value,
      weddingId: input.weddingId,
      actorId: input.authorId,
    },
  })

  return revisionResponse(row, value)
}

export async function listCommunicationDrafts(weddingId: string) {
  const rows = await db.contentRevision.findMany({
    where: { weddingId, section: AI_SECTIONS.draft, status: { not: 'archived' } },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.flatMap((row) => {
    try {
      return [revisionResponse(row, parse<AiCommunicationDraftValue>(row.value))]
    } catch {
      return []
    }
  })
}

export async function createCommunicationDraft(input: {
  weddingId: string
  authorId: string
  title: string
  audience?: string
  channel?: AiCommunicationDraftValue['channel']
  subject?: string | null
  body: string
}) {
  const draftId = `aidraft_${randomUUID().replace(/-/g, '')}`
  const now = new Date().toISOString()
  const value: AiCommunicationDraftValue = {
    schemaVersion: 1,
    draftId,
    title: clean(input.title, 200) || 'Untitled communication draft',
    audience: clean(input.audience, 200) || 'Unspecified audience',
    channel: input.channel ?? 'internal',
    subject: input.subject ? clean(input.subject, 300) : null,
    body: clean(input.body, 60_000),
    sourceArea: 'communication_assistant',
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    sentAt: null,
  }
  const row = await db.contentRevision.create({
    data: {
      section: AI_SECTIONS.draft,
      fieldKey: draftId,
      value: JSON.stringify(value),
      status: 'draft',
      weddingId: input.weddingId,
      authorId: input.authorId,
    },
  })
  await db.auditEvent.create({
    data: {
      action: 'ai.communication.draft.create',
      resourceType: AI_SECTIONS.draft,
      resourceId: row.id,
      afterValue: row.value,
      weddingId: input.weddingId,
      actorId: input.authorId,
    },
  })
  return revisionResponse(row, value)
}

export async function updateCommunicationDraft(input: {
  weddingId: string
  actorId: string
  id: string
  status?: AiCommunicationStatus
  title?: string
  audience?: string
  channel?: AiCommunicationDraftValue['channel']
  subject?: string | null
  body?: string
}) {
  const existing = await db.contentRevision.findFirst({
    where: { id: input.id, weddingId: input.weddingId, section: AI_SECTIONS.draft },
  })
  if (!existing) throw new Error('Communication draft not found.')
  const current = parse<AiCommunicationDraftValue>(existing.value)
  const now = new Date().toISOString()
  const next: AiCommunicationDraftValue = {
    ...current,
    title: input.title === undefined ? current.title : clean(input.title, 200),
    audience: input.audience === undefined ? current.audience : clean(input.audience, 200),
    channel: input.channel ?? current.channel,
    subject: input.subject === undefined ? current.subject : input.subject ? clean(input.subject, 300) : null,
    body: input.body === undefined ? current.body : clean(input.body, 60_000),
    updatedAt: now,
    approvedAt: input.status === 'approved' ? now : current.approvedAt,
    sentAt: input.status === 'sent' ? now : current.sentAt,
  }
  const row = await db.contentRevision.update({
    where: { id: existing.id },
    data: { value: JSON.stringify(next), status: input.status ?? existing.status },
  })
  await db.auditEvent.create({
    data: {
      action: `ai.communication.draft.${input.status ?? 'update'}`,
      resourceType: AI_SECTIONS.draft,
      resourceId: existing.id,
      beforeValue: existing.value,
      afterValue: row.value,
      weddingId: input.weddingId,
      actorId: input.actorId,
    },
  })
  return revisionResponse(row, next)
}

export async function listActionProposals(weddingId: string) {
  const rows = await db.contentRevision.findMany({
    where: { weddingId, section: AI_SECTIONS.proposal },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return rows.flatMap((row) => {
    try {
      return [revisionResponse(row, parse<AiActionProposalValue>(row.value))]
    } catch {
      return []
    }
  })
}

export async function createActionProposal(input: {
  weddingId: string
  authorId: string
  type: AiProposalType
  summary: string
  payload: Record<string, unknown>
  preview?: Record<string, unknown>
}) {
  const proposalId = `aiprop_${randomUUID().replace(/-/g, '')}`
  const value: AiActionProposalValue = {
    schemaVersion: 1,
    proposalId,
    type: input.type,
    summary: clean(input.summary, 1_500),
    payload: input.payload,
    preview: input.preview ?? {},
    createdAt: new Date().toISOString(),
    approvedAt: null,
    rejectedAt: null,
    executedAt: null,
    failure: null,
  }
  const row = await db.contentRevision.create({
    data: {
      section: AI_SECTIONS.proposal,
      fieldKey: proposalId,
      value: JSON.stringify(value),
      status: 'proposed',
      weddingId: input.weddingId,
      authorId: input.authorId,
    },
  })
  await db.auditEvent.create({
    data: {
      action: 'ai.action.propose',
      resourceType: AI_SECTIONS.proposal,
      resourceId: row.id,
      afterValue: row.value,
      weddingId: input.weddingId,
      actorId: input.authorId,
    },
  })
  return revisionResponse(row, value)
}

export async function setProposalStatus(input: {
  weddingId: string
  actorId: string
  id: string
  status: AiProposalStatus
  failure?: string | null
}) {
  const existing = await db.contentRevision.findFirst({
    where: { id: input.id, weddingId: input.weddingId, section: AI_SECTIONS.proposal },
  })
  if (!existing) throw new Error('AI action proposal not found.')
  const current = parse<AiActionProposalValue>(existing.value)
  const now = new Date().toISOString()
  const next: AiActionProposalValue = {
    ...current,
    approvedAt: input.status === 'approved' ? now : current.approvedAt,
    rejectedAt: input.status === 'rejected' ? now : current.rejectedAt,
    executedAt: input.status === 'executed' ? now : current.executedAt,
    failure: input.status === 'failed' ? clean(input.failure, 2_000) : null,
  }
  const row = await db.contentRevision.update({
    where: { id: existing.id },
    data: { status: input.status, value: JSON.stringify(next) },
  })
  await db.auditEvent.create({
    data: {
      action: `ai.action.${input.status}`,
      resourceType: AI_SECTIONS.proposal,
      resourceId: row.id,
      beforeValue: existing.value,
      afterValue: row.value,
      weddingId: input.weddingId,
      actorId: input.actorId,
    },
  })
  return revisionResponse(row, next)
}

function chunkText(text: string, max = 1_600, overlap = 180): string[] {
  const normalized = clean(text, 200_000)
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

export async function ingestAiDocument(input: {
  weddingId: string
  actorId: string
  title: string
  kind?: AiDocumentValue['kind']
  sourceUrl?: string | null
  visibility?: AiDocumentValue['visibility']
  retentionUntil?: string | null
  text: string
}) {
  const documentId = `aidoc_${randomUUID().replace(/-/g, '')}`
  const title = clean(input.title, 240) || 'Untitled document'
  const text = clean(input.text, 200_000)
  if (text.length < 20) throw new Error('Document text is too short to index.')
  const chunks = chunkText(text)
  const now = new Date().toISOString()
  const checksum = createHash('sha256').update(text).digest('hex')
  const metadata: AiDocumentValue = {
    schemaVersion: 1,
    documentId,
    title,
    kind: input.kind ?? 'other',
    sourceUrl: input.sourceUrl ? clean(input.sourceUrl, 1_000) : null,
    visibility: input.visibility === 'public' ? 'public' : 'private',
    retentionUntil: input.retentionUntil ? new Date(input.retentionUntil).toISOString() : null,
    checksum,
    chunkCount: chunks.length,
    indexedAt: now,
    createdAt: now,
  }

  await db.$transaction(async (tx) => {
    await tx.weddingContent.create({
      data: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.document,
        field: documentId,
        value: JSON.stringify(metadata),
        metadata: JSON.stringify({ visibility: metadata.visibility, published: metadata.visibility === 'public' }),
      },
    })
    for (let index = 0; index < chunks.length; index += 1) {
      await tx.weddingContent.create({
        data: {
          weddingId: input.weddingId,
          section: AI_SECTIONS.documentChunk,
          field: `${documentId}:${String(index).padStart(4, '0')}`,
          value: JSON.stringify({
            documentId,
            title,
            text: chunks[index],
            sourceUrl: metadata.sourceUrl,
            visibility: metadata.visibility,
            chunkIndex: index,
            checksum,
          }),
          order: index,
          metadata: JSON.stringify({ visibility: metadata.visibility, published: metadata.visibility === 'public' }),
        },
      })
    }
  })

  await db.auditEvent.create({
    data: {
      action: 'ai.document.ingest',
      resourceType: AI_SECTIONS.document,
      resourceId: documentId,
      afterValue: JSON.stringify(metadata),
      weddingId: input.weddingId,
      actorId: input.actorId,
    },
  })
  return metadata
}

export async function listAiDocuments(weddingId: string) {
  const rows = await db.weddingContent.findMany({
    where: { weddingId, section: AI_SECTIONS.document },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.flatMap((row) => {
    try {
      return [{ id: row.id, ...parse<AiDocumentValue>(row.value), updatedAt: row.updatedAt.toISOString() }]
    } catch {
      return []
    }
  })
}

export async function deleteAiDocument(input: {
  weddingId: string
  actorId: string
  documentId: string
}) {
  const document = await db.weddingContent.findFirst({
    where: { weddingId: input.weddingId, section: AI_SECTIONS.document, field: input.documentId },
  })
  if (!document) throw new Error('AI document not found.')
  const chunks = await db.weddingContent.findMany({
    where: {
      weddingId: input.weddingId,
      section: AI_SECTIONS.documentChunk,
      field: { startsWith: `${input.documentId}:` },
    },
    select: { id: true },
  })
  await db.weddingContent.deleteMany({
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
  await db.auditEvent.create({
    data: {
      action: 'ai.document.delete',
      resourceType: AI_SECTIONS.document,
      resourceId: input.documentId,
      beforeValue: document.value,
      afterValue: JSON.stringify({ deletedChunks: chunks.length }),
      weddingId: input.weddingId,
      actorId: input.actorId,
    },
  })
  return { documentId: input.documentId, deletedChunks: chunks.length }
}

export async function deleteExpiredAiDocuments(input: {
  weddingId: string
  actorId: string
}) {
  const documents = await listAiDocuments(input.weddingId)
  const expired = documents.filter(
    (document) => document.retentionUntil && new Date(document.retentionUntil).getTime() <= Date.now(),
  )
  const results = []
  for (const document of expired) {
    results.push(
      await deleteAiDocument({
        weddingId: input.weddingId,
        actorId: input.actorId,
        documentId: document.documentId,
      }),
    )
  }
  return results
}
