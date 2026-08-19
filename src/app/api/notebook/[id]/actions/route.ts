import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applySuggestions } from '@/lib/notebook/actions'
import { createNotebookCheckpoint } from '@/lib/notebook/history'
import { notebookErrorResponse, requireNotebookActor } from '@/lib/notebook/http'
import { setNotebookTags } from '@/lib/notebook/metadata'
import { notifyNotebookShare } from '@/lib/notebook/share-notifications'
import {
  addLink,
  getNote,
  rejectSuggestion,
  removeLink,
  restoreDeletedNote,
  restoreVersion,
  revokeShare,
  updateNote,
  upsertShare,
} from '@/lib/notebook/store'
import { getTranscript } from '@/lib/notebook/media'
import { NotebookValidationError } from '@/lib/notebook/types'

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error

  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : ''

    if (action === 'restore-deleted') {
      const note = await restoreDeletedNote(access.actor, id)
      return NextResponse.json({ success: true, data: note })
    }
    if (action === 'restore-version') {
      const note = await restoreVersion(access.actor, id, Number(body.version), Number(body.expectedVersion))
      return NextResponse.json({ success: true, data: note })
    }
    if (action === 'save-checkpoint') {
      const checkpoint = await createNotebookCheckpoint(access.actor, id, Number(body.expectedVersion))
      return NextResponse.json({ success: true, data: checkpoint })
    }
    if (action === 'accept-ai') {
      const note = await updateNote(
        access.actor,
        id,
        {
          expectedVersion: Number(body.expectedVersion),
          title: body.title,
          contentText: body.previewText,
        },
        'AI',
        {
          provider: typeof body.provider === 'string' ? body.provider : undefined,
          model: typeof body.model === 'string' ? body.model : undefined,
          promptVersion: typeof body.promptVersion === 'string' ? body.promptVersion : undefined,
        },
      )
      return NextResponse.json({ success: true, data: note })
    }
    if (action === 'set-tags') {
      const tags = await setNotebookTags(access.actor, id, body.tags)
      return NextResponse.json({ success: true, data: { tags } })
    }
    if (action === 'share') {
      let userId = typeof body.userId === 'string' ? body.userId : ''
      if (!userId && typeof body.email === 'string') {
        const user = await db.user.findUnique({
          where: { email: body.email.trim().toLowerCase() },
          select: { id: true },
        })
        userId = user?.id ?? ''
      }
      if (!userId) throw new NotebookValidationError('Choose an existing Wewed user to share with.')
      const role = body.role === 'EDITOR' ? 'EDITOR' : 'VIEWER'
      await upsertShare(access.actor, id, { userId, role })

      // Access is authoritative and succeeds independently. Notification is
      // best-effort through the canonical Wewed communications delivery pipeline.
      const notification = await notifyNotebookShare(access.actor, id, userId, role)
      return NextResponse.json({ success: true, data: { shared: true, notification } })
    }
    if (action === 'revoke-share') {
      if (typeof body.userId !== 'string') throw new NotebookValidationError('userId is required.')
      await revokeShare(access.actor, id, body.userId)
      return NextResponse.json({ success: true })
    }
    if (action === 'add-link') {
      if (typeof body.entityType !== 'string' || typeof body.entityId !== 'string') {
        throw new NotebookValidationError('entityType and entityId are required.')
      }
      await addLink(access.actor, id, {
        entityType: body.entityType,
        entityId: body.entityId,
        labelSnapshot: typeof body.labelSnapshot === 'string' ? body.labelSnapshot : null,
      })
      return NextResponse.json({ success: true })
    }
    if (action === 'remove-link') {
      if (typeof body.linkId !== 'string') throw new NotebookValidationError('linkId is required.')
      await removeLink(access.actor, id, body.linkId)
      return NextResponse.json({ success: true })
    }
    if (action === 'reject-suggestion') {
      if (typeof body.suggestionId !== 'string') throw new NotebookValidationError('suggestionId is required.')
      await rejectSuggestion(access.actor, id, body.suggestionId)
      return NextResponse.json({ success: true })
    }
    if (action === 'apply-suggestions') {
      const ids = Array.isArray(body.suggestionIds)
        ? body.suggestionIds.filter((value): value is string => typeof value === 'string')
        : []
      if (!ids.length) throw new NotebookValidationError('Select at least one suggestion to apply.')
      const results = await applySuggestions(access.actor, id, ids)
      return NextResponse.json({ success: true, data: results })
    }
    if (action === 'append-transcript') {
      if (typeof body.recordingId !== 'string') throw new NotebookValidationError('recordingId is required.')
      const transcript = await getTranscript(access.actor, body.recordingId)
      if (!transcript) throw new NotebookValidationError('Transcribe the recording before appending it.')
      const note = await getNote(access.actor, id)
      const heading = note.contentText.trim() ? '\n\n## Transcript\n\n' : '## Transcript\n\n'
      const updated = await updateNote(
        access.actor,
        id,
        {
          expectedVersion: Number(body.expectedVersion),
          contentText: `${note.contentText}${heading}${transcript.text}`,
        },
        'SYSTEM',
      )
      return NextResponse.json({ success: true, data: updated })
    }

    throw new NotebookValidationError('Unsupported Notebook action.')
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
