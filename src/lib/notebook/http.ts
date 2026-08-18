import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getNotebookActor } from './access'
import {
  NotebookConflictError,
  NotebookForbiddenError,
  NotebookNotFoundError,
  NotebookValidationError,
  type NotebookActor,
} from './types'

export async function requireNotebookActor(request: NextRequest): Promise<
  { actor: NotebookActor; error: null } | { actor: null; error: NextResponse }
> {
  const actor = await getNotebookActor(request)
  if (!actor) {
    return {
      actor: null,
      error: NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 }),
    }
  }
  return { actor, error: null }
}

export function notebookErrorResponse(error: unknown): NextResponse {
  if (error instanceof NotebookNotFoundError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 404 })
  }
  if (error instanceof NotebookForbiddenError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 403 })
  }
  if (error instanceof NotebookConflictError) {
    return NextResponse.json(
      { success: false, code: 'NOTE_VERSION_CONFLICT', error: error.message },
      { status: 409 },
    )
  }
  if (error instanceof NotebookValidationError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
  console.error('[NOTEBOOK] request failed:', error instanceof Error ? error.message : 'unknown error')
  return NextResponse.json({ success: false, error: 'Notebook request failed.' }, { status: 500 })
}
