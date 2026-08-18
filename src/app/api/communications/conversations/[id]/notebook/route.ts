import { NextRequest, NextResponse } from 'next/server'
import {
  listCommunicationConversations,
  listCommunicationMessages,
  requireCommunicationActor,
  sendCommunicationMessage,
} from '@/lib/communications'
import { getNotebookActor } from '@/lib/notebook/access'
import { runNotebookAi } from '@/lib/notebook/intelligence'
import { addLink, createNote } from '@/lib/notebook/store'
import { notebookErrorResponse } from '@/lib/notebook/http'
import { NotebookForbiddenError, NotebookValidationError } from '@/lib/notebook/types'

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const communicationActor = await requireCommunicationActor(request)
    const notebookActor = await getNotebookActor(request)
    if (!notebookActor || notebookActor.session.userId !== communicationActor.userId) {
      throw new NotebookForbiddenError()
    }
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : 'save-as-note'

    if (action === 'send-reviewed') {
      if (typeof body.message !== 'string' || !body.message.trim()) {
        throw new NotebookValidationError('A reviewed message is required before sending.')
      }
      const sent = await sendCommunicationMessage(communicationActor, id, {
        body: body.message,
        internalNote: body.internalNote === true,
      })
      return NextResponse.json({ success: true, data: sent })
    }

    const [messages, conversations] = await Promise.all([
      listCommunicationMessages(communicationActor, id),
      listCommunicationConversations(communicationActor),
    ])
    const conversation = conversations.find((item) => item.id === id)
    if (!conversation) throw new NotebookForbiddenError('Conversation is not accessible.')
    if (messages.length === 0) throw new NotebookValidationError('Conversation has no messages to save.')

    const transcript = messages
      .map((message) => `**${message.senderName || 'Wewed'}** · ${message.createdAt}\n\n${message.body}`)
      .join('\n\n---\n\n')
    const weddingId = conversation.weddingId && notebookActor.editableWeddingIds.includes(conversation.weddingId)
      ? conversation.weddingId
      : null
    const visibility = communicationActor.role === 'admin'
      ? 'ADMIN_INTERNAL'
      : weddingId
        ? 'WEDDING_TEAM'
        : 'PRIVATE'
    const note = await createNote(notebookActor, {
      title: conversation.title ? `Conversation — ${conversation.title}` : 'Conversation notes',
      contentText: `# Conversation capture\n\n${transcript}`,
      weddingId,
      noteType: 'GENERAL',
      visibility,
      contextType: 'communication',
    })
    await addLink(notebookActor, note.id, {
      entityType: 'communication',
      entityId: id,
      labelSnapshot: conversation.title || conversation.type,
    })

    let summary: Record<string, unknown> | null = null
    if (body.summarize === true) {
      summary = await runNotebookAi(notebookActor, note.id, 'SUMMARY')
    }
    return NextResponse.json({ success: true, data: { note, summary } }, { status: 201 })
  } catch (error) {
    return notebookErrorResponse(error)
  }
}
