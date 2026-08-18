import { NextRequest, NextResponse } from 'next/server'
import { askNotebook } from '@/lib/notebook/intelligence'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import { NotebookValidationError } from '@/lib/notebook/types'

export async function POST(request: NextRequest) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const body = (await request.json()) as Record<string, unknown>
    const question = typeof body.question === 'string' ? body.question : ''
    if (!question.trim()) throw new NotebookValidationError('Question is required.')
    const data = await askNotebook(access.actor, question, {
      weddingId: typeof body.weddingId === 'string' ? body.weddingId : null,
      noteType: typeof body.noteType === 'string' ? body.noteType : null,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
