import { NextRequest, NextResponse } from 'next/server'
import { runNotebookAi } from '@/lib/notebook/intelligence'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import { NOTE_AI_OPERATIONS, NotebookValidationError, type NotebookAiOperation } from '@/lib/notebook/types'

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const operation = typeof body.operation === 'string' ? body.operation : ''
    if (!NOTE_AI_OPERATIONS.includes(operation as NotebookAiOperation)) {
      throw new NotebookValidationError('Unsupported Notebook AI operation.')
    }
    const data = await runNotebookAi(
      access.actor,
      id,
      operation as NotebookAiOperation,
      typeof body.instruction === 'string' ? body.instruction : undefined,
    )
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
