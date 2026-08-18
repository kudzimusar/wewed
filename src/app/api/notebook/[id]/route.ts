import { NextRequest, NextResponse } from 'next/server'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import {
  deleteNote,
  getNote,
  listLinks,
  listShares,
  listSuggestions,
  listVersions,
  updateNote,
} from '@/lib/notebook/store'
import { listRecordings } from '@/lib/notebook/media'

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    const note = await getNote(access.actor, id, request.nextUrl.searchParams.get('includeDeleted') === '1')
    const [links, versions, suggestions, recordings] = await Promise.all([
      listLinks(access.actor, id),
      listVersions(access.actor, id),
      listSuggestions(access.actor, id),
      listRecordings(access.actor, id),
    ])
    let shares: unknown[] = []
    try { shares = await listShares(access.actor, id) } catch { shares = [] }
    return NextResponse.json({ success: true, data: { note, links, versions, suggestions, recordings, shares } })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const note = await updateNote(access.actor, id, {
      expectedVersion: Number(body.expectedVersion),
      title: body.title,
      contentText: body.contentText,
      weddingId: body.weddingId,
      visibility: body.visibility,
      noteType: body.noteType,
      contextType: body.contextType,
      isPinned: body.isPinned,
      archived: body.archived,
    })
    return NextResponse.json({ success: true, data: note })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  try {
    const { id } = await context.params
    await deleteNote(access.actor, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
