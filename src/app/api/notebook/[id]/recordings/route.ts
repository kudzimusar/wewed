import { NextRequest, NextResponse } from 'next/server'
import { consumeAiRateLimit } from '@/lib/ai/rate-limit'
import { listRecordings, transcribeRecording, uploadRecording } from '@/lib/notebook/media'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import { notebookTranscriptionConfigured } from '@/lib/notebook/transcription-config'
import { NotebookValidationError } from '@/lib/notebook/types'

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    const data = await listRecordings(access.actor, id)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new NotebookValidationError('Recording file is required.')
    const durationRaw = form.get('durationMs')
    const durationMs = typeof durationRaw === 'string' ? Number(durationRaw) : null
    const uploaded = await uploadRecording(access.actor, id, file, durationMs)

    // Audio is committed first. Automatic transcription is an additive, fail-closed
    // follow-up: a provider/rate-limit failure never removes the saved recording.
    if (notebookTranscriptionConfigured()) {
      const limit = await consumeAiRateLimit({
        scope: 'notebook-transcription',
        identity: access.actor.session.userId,
        maxRequests: 10,
        windowMs: 60 * 60 * 1000,
      })
      if (limit.ok) {
        await transcribeRecording(access.actor, uploaded.id)
      }
    }

    const recordings = await listRecordings(access.actor, id)
    const data = recordings.find((recording) => recording.id === uploaded.id) ?? uploaded
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
