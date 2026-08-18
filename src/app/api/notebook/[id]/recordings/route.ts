import { NextRequest, NextResponse } from 'next/server'
import { listRecordings, uploadRecording } from '@/lib/notebook/media'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
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
    const data = await uploadRecording(access.actor, id, file, durationMs)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
