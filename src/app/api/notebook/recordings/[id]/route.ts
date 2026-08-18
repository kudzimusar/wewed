import { NextRequest, NextResponse } from 'next/server'
import {
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
      const data = await transcribeRecording(access.actor, id)
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
