import { NextRequest, NextResponse } from 'next/server'
import { requireNotebookActor } from '@/lib/notebook/http'

export async function GET(request: NextRequest) {
  const access = await requireNotebookActor(request)
  if (access.error) return access.error
  return NextResponse.json({
    success: true,
    data: {
      role: access.actor.session.role,
      platformAdmin: access.actor.platformAdmin,
      activeWeddingId: access.actor.session.activeWeddingId,
      weddings: access.actor.weddings.map((wedding) => ({
        id: wedding.id,
        title: wedding.title,
        date: wedding.date,
        venue: wedding.venue,
        membershipRole: wedding.membershipRole,
        canEdit: access.actor.editableWeddingIds.includes(wedding.id),
      })),
    },
  })
}
