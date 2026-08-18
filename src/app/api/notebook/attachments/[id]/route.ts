import { NextRequest, NextResponse } from 'next/server'
import { attachmentSignedUrl, deleteAttachment } from '@/lib/notebook/attachments'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    const signedUrl = await attachmentSignedUrl(access.actor, id)
    return NextResponse.json({ success: true, data: { signedUrl } })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    await deleteAttachment(access.actor, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
