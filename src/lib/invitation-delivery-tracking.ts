import 'server-only'

import { db } from '@/lib/db'

export async function recordInvitationOpened(weddingId: string, guestId: string) {
  const latest = await db.auditEvent.findFirst({
    where: {
      weddingId,
      resourceType: 'Guest',
      resourceId: guestId,
      action: { in: ['guest.invitation_opened', 'guest.invitation_delivery_reset'] },
    },
    select: { action: true },
    orderBy: { createdAt: 'desc' },
  })
  if (latest?.action === 'guest.invitation_opened') return

  await db.auditEvent.create({
    data: {
      action: 'guest.invitation_opened',
      resourceType: 'Guest',
      resourceId: guestId,
      weddingId,
      afterValue: JSON.stringify({ source: 'invitation_exchange' }),
    },
  })
}
