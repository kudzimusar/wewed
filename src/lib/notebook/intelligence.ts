import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { generateAiText } from '@/lib/ai'
import { actorCanEditNote } from './access'
import { getNote, listLinks, listNotes, writeAudit } from './store'
import {
  NOTE_AI_OPERATIONS,
  NotebookForbiddenError,
  NotebookValidationError,
  type NotebookActor,
  type NotebookAiOperation,
  type NotebookSuggestion,
} from './types'

const PROMPT_VERSION = 'notebook-intelligence-v1-2026-08-18'
const MAX_CONTEXT_CHARS = 120_000

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first < 0 || last <= first) throw new NotebookValidationError('AI returned an invalid structured response.')
  const parsed = JSON.parse(cleaned.slice(first, last + 1)) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new NotebookValidationError('AI returned an invalid structured response.')
  }
  return parsed as Record<string, unknown>
}

function safeText(value: unknown, max = 20_000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function stableKey(noteId: string, sourceVersion: number, action: unknown): string {
  return createHash('sha256')
    .update(`${noteId}:${sourceVersion}:${JSON.stringify(action)}`)
    .digest('hex')
}

function sourceContainsExplicitNumber(source: string, value: number): boolean {
  const candidates = [
    String(value),
    value.toLocaleString('en-US'),
    value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ]
  return candidates.some((candidate) => source.includes(candidate))
}

function sourceContainsExplicitTime(source: string, value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return source.toLowerCase().includes(normalized)
}

const rewriteInstructions: Record<string, string> = {
  IMPROVE: 'Improve clarity and usefulness without changing facts, commitments, names, amounts, dates or decisions.',
  GRAMMAR: 'Correct spelling and grammar only. Preserve meaning and factual wording.',
  SHORTEN: 'Make the note substantially more concise while preserving every material fact, decision and action item.',
  EXPAND: 'Improve structure and readability, but do not invent any fact that is not present in the source.',
  PROFESSIONAL: 'Rewrite in a professional wedding-planning/operations tone while preserving all source facts.',
  CHECKLIST: 'Turn actionable statements into a Markdown checklist. Keep non-action factual context underneath.',
  STRUCTURE_MEETING: 'Organize into Markdown sections: Summary, Decisions, Actions, Open questions, Risks, Notes. Omit empty sections.',
}

async function persistDerivation(
  actor: NotebookActor,
  noteId: string,
  sourceVersion: number,
  kind: string,
  output: unknown,
  provider: string | null,
  model: string | null,
): Promise<string> {
  const id = randomUUID()
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_notebook."NotebookAiDerivation"
      (id, "noteId", kind, "sourceVersion", output, provider, model,
       "promptVersion", stale, "createdByUserId")
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,FALSE,$9)`,
    id,
    noteId,
    kind,
    sourceVersion,
    JSON.stringify(output),
    provider,
    model,
    PROMPT_VERSION,
    actor.session.userId,
  )
  return id
}

async function buildAuthorizedContext(actor: NotebookActor, noteId: string): Promise<{
  source: string
  context: string
}> {
  const note = await getNote(actor, noteId)
  const links = await listLinks(actor, noteId)
  const wedding = note.weddingId
    ? actor.weddings.find((item) => item.id === note.weddingId) ?? null
    : null

  const context = [
    wedding
      ? `Wedding context: ${wedding.title}; date ${wedding.date.toISOString()}; venue ${wedding.venue}, ${wedding.venueCity}, ${wedding.venueCountry}.`
      : '',
    links.length
      ? `User-authorized linked records: ${links
          .slice(0, 50)
          .map((link) => `${link.entityType}:${link.labelSnapshot || link.entityId}`)
          .join('; ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 20_000)

  return {
    source: note.contentText.slice(0, MAX_CONTEXT_CHARS),
    context,
  }
}

export async function runNotebookAi(
  actor: NotebookActor,
  noteId: string,
  operation: NotebookAiOperation,
  instruction?: string,
): Promise<Record<string, unknown>> {
  if (!NOTE_AI_OPERATIONS.includes(operation)) {
    throw new NotebookValidationError('Unsupported Notebook AI operation.')
  }
  const note = await getNote(actor, noteId)
  const { source, context } = await buildAuthorizedContext(actor, noteId)
  if (!source.trim()) throw new NotebookValidationError('Write or transcribe something before using AI.')

  if (rewriteInstructions[operation]) {
    const result = await generateAiText({
      profile: 'private',
      allowFallback: true,
      maxOutputTokens: 4096,
      messages: [
        {
          role: 'system',
          content:
            'You are Wewed Notebook writing intelligence. Work only from the authorized note supplied. Never add facts, prices, approvals, dates, identities, bookings or commitments that are not present. Return only the rewritten Markdown, with no preamble.',
        },
        { role: 'user', content: `${rewriteInstructions[operation]}\n${context}\n\nSOURCE NOTE:\n${source}` },
      ],
    })
    const output = { previewText: result.text.trim(), operation }
    const derivationId = await persistDerivation(
      actor,
      note.id,
      note.version,
      'REWRITE',
      output,
      result.provider,
      result.model,
    )
    await writeAudit(actor, note.id, 'AI_REWRITE_PREVIEWED', { operation, derivationId })
    return { ...output, derivationId, provider: result.provider, model: result.model, promptVersion: PROMPT_VERSION }
  }

  if (operation === 'SUMMARY' || operation === 'ANALYZE_MEETING' || operation === 'TITLE_TAGS_ENTITIES') {
    const result = await generateAiText({
      profile: 'private',
      allowFallback: true,
      maxOutputTokens: 4096,
      messages: [
        {
          role: 'system',
          content: `You are Wewed meeting intelligence. Use only the authorized source. Never infer an approval, amount, due date, identity, booking state or decision as confirmed unless explicitly stated. Distinguish confirmed facts from pending/uncertain items. Return JSON only with this shape: {"summary":"","minutes":"","decisions":[{"text":"","state":"confirmed|pending","evidence":""}],"actions":[{"text":"","assignee":null,"dueDate":null,"evidence":""}],"questions":[""],"risks":[""],"commitments":[{"text":"","evidence":""}],"entities":[{"type":"","label":"","evidence":""}],"tags":[""],"suggestedTitle":""}. Omit invented values.`,
        },
        { role: 'user', content: `${context}\n\nAUTHORIZED SOURCE:\n${source}` },
      ],
    })
    const structured = parseJsonObject(result.text)
    const derivationId = await persistDerivation(
      actor,
      note.id,
      note.version,
      operation === 'SUMMARY' ? 'SUMMARY' : operation === 'TITLE_TAGS_ENTITIES' ? 'ENTITIES' : 'MEETING_ANALYSIS',
      structured,
      result.provider,
      result.model,
    )
    await writeAudit(actor, note.id, 'AI_ANALYSIS_CREATED', { operation, derivationId })
    return { ...structured, derivationId, provider: result.provider, model: result.model, promptVersion: PROMPT_VERSION }
  }

  if (operation === 'SUGGEST_ACTIONS') {
    if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError('Read-only notes cannot generate executable suggestions.')
    if (!note.weddingId) throw new NotebookValidationError('Planner action suggestions require a wedding-scoped note.')

    const result = await generateAiText({
      profile: 'private',
      allowFallback: true,
      maxOutputTokens: 5000,
      messages: [
        {
          role: 'system',
          content: `You propose governed Wewed actions from meeting notes. Use only explicit source facts. Return JSON only: {"suggestions":[{"targetType":"TASK|BUDGET|TIMELINE|VENDOR|GUEST|COMMUNICATION|ADMIN","actionType":"CREATE_TASK|CREATE_BUDGET_ITEM|CREATE_TIMELINE_EVENT|DRAFT_COMMUNICATION|REVIEW_ONLY","payload":{},"rationale":"","evidence":"exact source fragment","confidence":0.0}]}. CREATE_TASK payload: {title,description?,category?,priority?,dueDate?,assignee?}. CREATE_BUDGET_ITEM only when an exact amount is explicitly stated; payload {description,category,estimatedCost,currency?,notes?}. CREATE_TIMELINE_EVENT only with an explicit time; payload {time,title,description?,location?}. DRAFT_COMMUNICATION payload {audience?,message}. Vendor, guest and admin changes must be REVIEW_ONLY unless represented as a safe task/communication. Never imply bookings, contracts, RSVP changes, payments or approvals.`,
        },
        { role: 'user', content: `${context}\n\nAUTHORIZED SOURCE:\n${source}` },
      ],
    })
    const parsed = parseJsonObject(result.text)
    const candidates = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    const accepted: NotebookSuggestion[] = []

    for (const raw of candidates.slice(0, 30)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
      const item = raw as Record<string, unknown>
      const targetType = safeText(item.targetType, 40).toUpperCase()
      const actionType = safeText(item.actionType, 60).toUpperCase()
      const payload = item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
        ? (item.payload as Record<string, unknown>)
        : {}
      const rationale = safeText(item.rationale, 2000)
      const evidence = safeText(item.evidence, 4000)
      const confidence = typeof item.confidence === 'number' && Number.isFinite(item.confidence)
        ? Math.min(1, Math.max(0, item.confidence))
        : null

      const allowed = ['CREATE_TASK','CREATE_BUDGET_ITEM','CREATE_TIMELINE_EVENT','DRAFT_COMMUNICATION','REVIEW_ONLY']
      if (!allowed.includes(actionType)) continue
      if (!['TASK','BUDGET','TIMELINE','VENDOR','GUEST','COMMUNICATION','ADMIN'].includes(targetType)) continue
      if (evidence && !source.toLowerCase().includes(evidence.toLowerCase())) continue

      if (actionType === 'CREATE_BUDGET_ITEM') {
        const amount = payload.estimatedCost
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || !sourceContainsExplicitNumber(source, amount)) continue
      }
      if (actionType === 'CREATE_TIMELINE_EVENT') {
        const time = safeText(payload.time, 80)
        if (!time || !sourceContainsExplicitTime(source, time)) continue
      }

      const serializable = { targetType, actionType, payload, rationale, evidence, confidence }
      const idempotencyKey = stableKey(note.id, note.version, serializable)
      const id = randomUUID()
      const rows = await db.$queryRawUnsafe<NotebookSuggestion[]>(
        `INSERT INTO wewed_notebook."NotebookSuggestion"
          (id, "noteId", "sourceVersion", "targetType", "actionType", payload,
           rationale, evidence, confidence, status, "idempotencyKey")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,'PENDING',$10)
         ON CONFLICT ("idempotencyKey") DO UPDATE SET
           rationale = EXCLUDED.rationale,
           evidence = EXCLUDED.evidence,
           confidence = EXCLUDED.confidence,
           "updatedAt" = CURRENT_TIMESTAMP
         RETURNING *`,
        id,
        note.id,
        note.version,
        targetType,
        actionType,
        JSON.stringify(payload),
        rationale || null,
        evidence || null,
        confidence,
        idempotencyKey,
      )
      if (rows[0]) accepted.push(rows[0])
    }

    const derivationId = await persistDerivation(
      actor,
      note.id,
      note.version,
      'ACTIONS',
      { suggestionIds: accepted.map((item) => item.id) },
      result.provider,
      result.model,
    )
    await writeAudit(actor, note.id, 'AI_ACTIONS_SUGGESTED', { count: accepted.length, derivationId })
    return { suggestions: accepted, derivationId, provider: result.provider, model: result.model, promptVersion: PROMPT_VERSION }
  }

  const result = await generateAiText({
    profile: 'private',
    allowFallback: true,
    maxOutputTokens: 4096,
    messages: [
      {
        role: 'system',
        content:
          'You are Wewed Notebook intelligence. Answer only from the authorized note and context. Clearly say when the source does not contain enough information. Do not invent wedding facts or operational state.',
      },
      { role: 'user', content: `${context}\n\nAUTHORIZED NOTE:\n${source}\n\nUSER REQUEST:\n${safeText(instruction, 8000) || 'Help me understand this note.'}` },
    ],
  })
  const output = { answer: result.text.trim(), operation: 'FREEFORM' }
  const derivationId = await persistDerivation(actor, note.id, note.version, 'FREEFORM', output, result.provider, result.model)
  await writeAudit(actor, note.id, 'AI_FREEFORM_ANSWERED', { derivationId })
  return { ...output, derivationId, provider: result.provider, model: result.model, promptVersion: PROMPT_VERSION }
}

export async function askNotebook(
  actor: NotebookActor,
  question: string,
  filters: { weddingId?: string | null; noteType?: string | null } = {},
): Promise<Record<string, unknown>> {
  const q = question.trim().slice(0, 2000)
  if (!q) throw new NotebookValidationError('Question is required.')

  // Authorization happens in listNotes before any note body reaches the model.
  const notes = await listNotes(actor, {
    query: q,
    weddingId: filters.weddingId,
    noteType: filters.noteType,
    archived: true,
    limit: 20,
  })

  if (notes.length === 0) {
    return { answer: 'I could not find an authorized Notebook source that supports an answer.', sources: [] }
  }

  const sourceBlocks = notes.map((note, index) =>
    `[SOURCE ${index + 1}] noteId=${note.id}; title=${note.title}; updated=${note.updatedAt.toISOString()}; type=${note.noteType}\n${note.contentText.slice(0, 8000)}`,
  )
  const result = await generateAiText({
    profile: 'private',
    allowFallback: true,
    maxOutputTokens: 3000,
    messages: [
      {
        role: 'system',
        content:
          'Answer the user using only the authorized Wewed Notebook sources. Cite claims inline as [SOURCE N]. If sources are insufficient or conflict, state that. Do not infer hidden/private information.',
      },
      { role: 'user', content: `QUESTION: ${q}\n\n${sourceBlocks.join('\n\n').slice(0, MAX_CONTEXT_CHARS)}` },
    ],
  })

  await writeAudit(actor, null, 'NOTEBOOK_RECALL_QUERIED', { sourceCount: notes.length, weddingId: filters.weddingId ?? null })
  return {
    answer: result.text.trim(),
    sources: notes.map((note, index) => ({
      number: index + 1,
      noteId: note.id,
      title: note.title,
      updatedAt: note.updatedAt,
      noteType: note.noteType,
    })),
    provider: result.provider,
    model: result.model,
    retrievalMode: 'authorized_full_text',
  }
}
