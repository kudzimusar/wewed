import 'server-only'

import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  CommunicationError,
  type CommunicationActor,
} from '@/lib/communications'
import { requireWewedAdmin } from '@/lib/wewed-admin'
import { assertAdminHistoricalWeddingScope } from '@/lib/admin-historical-engagement'

type AttachmentScopeRow = {
  weddingId: string
  conversationId: string
}

export async function authorizeCommunicationAttachmentPromotion(input: {
  request: NextRequest
  actor: CommunicationActor
  attachmentId: string
}): Promise<{ weddingId: string }> {
  const rows = await db.$queryRaw<AttachmentScopeRow[]>(Prisma.sql`
    SELECT a."weddingId", a."conversationId"
    FROM wewed_communications."CommunicationAttachment" a
    JOIN wewed_communications."CommunicationParticipant" p
      ON p."conversationId" = a."conversationId"
     AND p."userId" = ${input.actor.userId}
     AND p."leftAt" IS NULL
    WHERE a."id" = ${input.attachmentId}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) throw new CommunicationError('Attachment not found.', 404)

  if (input.actor.role === 'admin') {
    const context = await requireWewedAdmin(input.request, 'admin.support.manage')
    await assertAdminHistoricalWeddingScope(context, row.weddingId)
    return { weddingId: row.weddingId }
  }

  if (input.actor.role === 'vendor') {
    throw new CommunicationError(
      'Vendor attachments remain governed in the conversation Vault. Promotion into wedding operational records requires the couple, planner, or authorized Wewed support.',
      403,
    )
  }

  if (input.actor.activeWeddingId !== row.weddingId) {
    throw new CommunicationError('The active wedding does not match this attachment.', 403)
  }

  if (input.actor.role !== 'planner' && input.actor.role !== 'couple') {
    throw new CommunicationError('You cannot promote this attachment into operational records.', 403)
  }

  return { weddingId: row.weddingId }
}
