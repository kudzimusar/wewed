import { NextRequest, NextResponse } from 'next/server'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import { createNote, listNotes } from '@/lib/notebook/store'

export async function GET(request: NextRequest) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error

  try {
    const params = request.nextUrl.searchParams
    const notes = await listNotes(access.actor, {
      query: params.get('q'),
      weddingId: params.get('weddingId'),
      noteType: params.get('noteType'),
      pinned: params.get('pinned') === '1',
      archived: params.get('archived') === '1',
      deleted: params.get('deleted') === '1',
      limit: Number(params.get('limit') || 200),
    })
    return NextResponse.json({ success: true, count: notes.length, data: notes })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error

  try {
    const body = (await request.json()) as Record<string, unknown>
    const note = await createNote(access.actor, body)
    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
