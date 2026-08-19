import { NextRequest, NextResponse } from 'next/server'
import { consumeAiRateLimit } from '@/lib/ai/rate-limit'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import { askNotebookRecall } from '@/lib/notebook/recall'
import { NotebookValidationError } from '@/lib/notebook/types'

export async function POST(request: NextRequest) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const body = (await request.json()) as Record<string, unknown>
    const question = typeof body.question === 'string' ? body.question : ''
    if (!question.trim()) throw new NotebookValidationError('Question is required.')
    const limit = await consumeAiRateLimit({
      scope: 'notebook-recall',
      identity: access.actor.session.userId,
      maxRequests: 30,
      windowMs: 10 * 60 * 1000,
    })
    if (!limit.ok) {
      const retryAfter = Math.max(1, Math.ceil((limit.retryAfterMs ?? 60_000) / 1000))
      return NextResponse.json(
        { success: false, error: 'Notebook recall rate limit reached. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      )
    }
    const data = await askNotebookRecall(access.actor, question, {
      weddingId: typeof body.weddingId === 'string' ? body.weddingId : null,
      noteType: typeof body.noteType === 'string' ? body.noteType : null,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
