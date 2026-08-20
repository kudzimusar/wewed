import { NextRequest, NextResponse } from 'next/server'
import { consumeAiRateLimit } from '@/lib/ai/rate-limit'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import { transcribeNotebookAudioChunk } from '@/lib/notebook/media'
import { NotebookValidationError } from '@/lib/notebook/types'

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error

  try {
    const { id } = await context.params
    const limit = await consumeAiRateLimit({
      scope: 'notebook-live-transcription',
      identity: access.actor.session.userId,
      maxRequests: 240,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.ok) {
      const retryAfter = Math.max(1, Math.ceil((limit.retryAfterMs ?? 60_000) / 1000))
      return NextResponse.json(
        { success: false, error: 'Live transcription rate limit reached. Recording continues and remains preserved.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      )
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new NotebookValidationError('Transcription audio chunk is required.')
    const promptRaw = form.get('prompt')
    const prompt = typeof promptRaw === 'string' ? promptRaw : undefined
    const data = await transcribeNotebookAudioChunk(access.actor, id, file, prompt)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
