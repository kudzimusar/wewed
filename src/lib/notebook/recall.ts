import 'server-only'

import { generateAiText } from '@/lib/ai'
import { listNotes, writeAudit } from './store'
import { NotebookValidationError, type NotebookActor, type NotebookNoteRow } from './types'

const MAX_CONTEXT_CHARS = 120_000
const MAX_RECALL_TERMS = 8
const MAX_SOURCES = 20

const RECALL_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could', 'did',
  'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'is', 'it',
  'me', 'my', 'of', 'on', 'or', 'our', 'please', 'tell', 'that', 'the', 'their', 'them',
  'there', 'these', 'they', 'this', 'to', 'us', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
])

export function extractNotebookRecallTerms(question: string): string[] {
  const tokens = question
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !RECALL_STOP_WORDS.has(token))

  return Array.from(new Set(tokens)).slice(0, MAX_RECALL_TERMS)
}

export function rankNotebookRecallCandidates(
  notes: NotebookNoteRow[],
  terms: string[],
): NotebookNoteRow[] {
  const scored = notes.map((note) => {
    const title = note.title.toLowerCase()
    const body = note.contentText.toLowerCase()
    const score = terms.reduce((total, term) => {
      const titleHit = title.includes(term) ? 4 : 0
      const bodyHit = body.includes(term) ? 1 : 0
      return total + titleHit + bodyHit
    }, 0)
    return { note, score }
  })

  return scored
    .sort((a, b) => b.score - a.score || b.note.updatedAt.getTime() - a.note.updatedAt.getTime())
    .map((entry) => entry.note)
}

async function recallAuthorizedNotes(
  actor: NotebookActor,
  question: string,
  filters: { weddingId?: string | null; noteType?: string | null },
): Promise<NotebookNoteRow[]> {
  const terms = extractNotebookRecallTerms(question)
  const unique = new Map<string, NotebookNoteRow>()

  // Search meaningful terms independently. A natural-language question should not
  // fail merely because filler words such as "what did we decide about" are absent
  // from an otherwise relevant note.
  for (const term of terms) {
    const matches = await listNotes(actor, {
      query: term,
      weddingId: filters.weddingId,
      noteType: filters.noteType,
      archived: true,
      limit: 12,
    })
    for (const note of matches) unique.set(note.id, note)
  }

  if (unique.size > 0) {
    return rankNotebookRecallCandidates(Array.from(unique.values()), terms).slice(0, MAX_SOURCES)
  }

  // Fail safely, not falsely: if lexical recall finds no hit, give the model only
  // the most recent notes already authorized by the same wedding/type scope. The
  // model still must state when those sources do not support the requested answer.
  const fallback = await listNotes(actor, {
    weddingId: filters.weddingId,
    noteType: filters.noteType,
    archived: true,
    limit: MAX_SOURCES,
  })
  return rankNotebookRecallCandidates(fallback, terms).slice(0, MAX_SOURCES)
}

export async function askNotebookRecall(
  actor: NotebookActor,
  question: string,
  filters: { weddingId?: string | null; noteType?: string | null } = {},
): Promise<Record<string, unknown>> {
  const q = question.trim().slice(0, 2000)
  if (!q) throw new NotebookValidationError('Question is required.')

  const notes = await recallAuthorizedNotes(actor, q, filters)
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
          'Answer the user using only the authorized Wewed Notebook sources. Cite claims inline as [SOURCE N]. If sources are insufficient or conflict, state that. Do not infer hidden/private information. Prefer a directly matching source over a merely recent fallback source.',
      },
      {
        role: 'user',
        content: `QUESTION: ${q}\n\n${sourceBlocks.join('\n\n').slice(0, MAX_CONTEXT_CHARS)}`,
      },
    ],
  })

  await writeAudit(actor, null, 'NOTEBOOK_ASKED', {
    sourceCount: notes.length,
    retrievalTerms: extractNotebookRecallTerms(q),
  })

  return {
    answer: result.text.trim(),
    sources: notes.map((note) => ({ noteId: note.id, title: note.title })),
    provider: result.provider,
    model: result.model,
  }
}
