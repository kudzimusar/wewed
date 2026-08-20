import { NextRequest, NextResponse } from 'next/server'
import { consumeAiRateLimit } from '@/lib/ai/rate-limit'
import {
  attachTranscript,
  getRecordingSignedUrl,
  getTranscript,
  transcribeRecording,
  updateTranscript,
} from '@/lib/notebook/media'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import { NotebookValidationError } from '@/lib/notebook/types'

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    const [url, transcript] = await Promise.all([
      getRecordingSignedUrl(access.actor, id),
      getTranscript(access.actor, id),
    ])
    return NextResponse.json({ success: true, data: { signedUrl: url, transcript } })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : 'transcribe'
    if (action === 'transcribe' || action === 'retry-transcription') {
      const limit = await consumeAiRateLimit({
        scope: 'notebook-transcription',
        identity: access.actor.session.userId,
        maxRequests: 10,
        windowMs: 60 * 60 * 1000,
      })
      if (!limit.ok) {
        const retryAfter = Math.max(1, Math.ceil((limit.retryAfterMs ?? 60_000) / 1000))
        return NextResponse.json(
          { success: false, error: 'Transcription rate limit reached. Your recordings remain saved.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        )
      }
      const data = await transcribeRecording(access.actor, id)
      return NextResponse.json({ success: true, data })
    }
    if (action === 'attach-transcript') {
      if (typeof body.text !== 'string') throw new NotebookValidationError('Transcript text is required.')
      const data = await attachTranscript(access.actor, id, body.text, body.segments, 'wewed-live-transcription')
      return NextResponse.json({ success: true, data })
    }
    if (action === 'update-transcript') {
      if (typeof body.text !== 'string') throw new NotebookValidationError('Transcript text is required.')
      const data = await updateTranscript(access.actor, id, body.text, body.segments)
      return NextResponse.json({ success: true, data })
    }
    throw new NotebookValidationError('Unsupported recording action.')
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
