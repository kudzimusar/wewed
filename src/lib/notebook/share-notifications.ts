import 'server-only'

import { db } from '@/lib/db'
import { isDashboardRole } from '@/lib/app-session'
import {
  createCommunicationConversation,
  sendCommunicationMessage,
  type CommunicationActor,
} from '@/lib/communications'
import { getNote, writeAudit } from './store'
import type { NotebookActor, NotebookNoteRow } from './types'

function notebookUrlForRole(role: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://wewed.pro').replace(/\/$/, '')
  return role === 'admin' ? `${base}/admin/notebook` : `${base}/planner/notebook`
}

async function communicationActorForNotebook(
  actor: NotebookActor,
  note: NotebookNoteRow,
): Promise<CommunicationActor | null> {
  const user = await db.user.findUnique({
    where: { id: actor.session.userId },
    select: { id: true, email: true, name: true, role: true, coupleId: true, isActive: true },
  })
  if (!user?.isActive || !isDashboardRole(user.role)) return null

  return {
    userId: user.id,
    email: user.email,
    name: user.name?.trim() || user.email,
    role: user.role,
    coupleId: user.coupleId,
    activeWeddingId: note.weddingId || actor.session.activeWeddingId,
  }
}

export async function notifyNotebookShare(
  actor: NotebookActor,
  noteId: string,
  recipientUserId: string,
  role: 'VIEWER' | 'EDITOR',
): Promise<{ notified: boolean; reason?: string }> {
  if (!recipientUserId || recipientUserId === actor.session.userId) {
    return { notified: false, reason: 'self' }
  }

  const note = await getNote(actor, noteId)
  const [sender, recipient] = await Promise.all([
    communicationActorForNotebook(actor, note),
    db.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true, role: true, isActive: true },
    }),
  ])
  if (!sender || !recipient?.isActive || !isDashboardRole(recipient.role)) {
    await writeAudit(actor, noteId, 'NOTE_SHARE_NOTIFICATION_SKIPPED', {
      recipientUserId,
      reason: 'communication_identity_unavailable',
    })
    return { notified: false, reason: 'communication_identity_unavailable' }
  }

  try {
    const conversation = await createCommunicationConversation(sender, {
      participantIds: [recipient.id],
      weddingId: note.weddingId,
    })
    const permission = role === 'EDITOR' ? 'edit' : 'view'
    const link = notebookUrlForRole(recipient.role)
    await sendCommunicationMessage(sender, conversation.id, {
      body: `A Wewed Notebook note was shared with you with permission to ${permission}: "${note.title}". Open it securely in Wewed Notebook: ${link}`,
    })
    await writeAudit(actor, noteId, 'NOTE_SHARE_NOTIFICATION_QUEUED', {
      recipientUserId,
      channelOwner: 'wewed_communications',
      permission: role,
    })
    return { notified: true }
  } catch {
    // Access was already granted by Notebook. Notification is intentionally
    // fail-soft so an email/WhatsApp/conversation problem never revokes access.
    await writeAudit(actor, noteId, 'NOTE_SHARE_NOTIFICATION_FAILED', {
      recipientUserId,
      channelOwner: 'wewed_communications',
    })
    return { notified: false, reason: 'communication_unavailable' }
  }
}

export async function notifyNotebookWeddingTeam(
  actor: NotebookActor,
  noteId: string,
): Promise<{ attempted: number; notified: number }> {
  const note = await getNote(actor, noteId)
  if (!note.weddingId) return { attempted: 0, notified: 0 }

  const wedding = await db.wedding.findUnique({
    where: { id: note.weddingId },
    select: { coupleId: true },
  })
  if (!wedding) return { attempted: 0, notified: 0 }

  const [memberships, coupleUsers] = await Promise.all([
    db.weddingMembership.findMany({
      where: { weddingId: note.weddingId, status: 'active', user: { isActive: true } },
      select: { userId: true },
    }),
    db.user.findMany({
      where: { coupleId: wedding.coupleId, isActive: true },
      select: { id: true },
    }),
  ])

  const recipients = Array.from(new Set([
    ...memberships.map((membership) => membership.userId),
    ...coupleUsers.map((user) => user.id),
  ])).filter((userId) => userId !== actor.session.userId)

  let notified = 0
  for (const recipientUserId of recipients) {
    const result = await notifyNotebookShare(actor, noteId, recipientUserId, 'VIEWER')
    if (result.notified) notified += 1
  }

  await writeAudit(actor, noteId, 'NOTE_WEDDING_TEAM_NOTIFICATION_COMPLETED', {
    attempted: recipients.length,
    notified,
  })
  return { attempted: recipients.length, notified }
}
