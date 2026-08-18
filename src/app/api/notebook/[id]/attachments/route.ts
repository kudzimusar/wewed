import { NextRequest, NextResponse } from 'next/server'
import { listAttachments, uploadAttachment } from '@/lib/notebook/attachments'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import { NotebookValidationError } from '@/lib/notebook/types'

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    const data = await listAttachments(access.actor, id)
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
    if (!(file instanceof File)) throw new NotebookValidationError('Attachment file is required.')
    const data = await uploadAttachment(access.actor, id, file)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
