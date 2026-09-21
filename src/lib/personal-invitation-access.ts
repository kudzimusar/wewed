import 'server-only'

import { db } from '@/lib/db'
import {
  normalizeInvitationCardStyle,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

export interface ResolvedPersonalInvitation {
  weddingDate: Date
  weddingId: string
  weddingSlug: string
  weddingTitle: string
  guestId: string
  rsvpToken: string
  card: InvitationCardStyle
}

export async function resolvePersonalInvitation({
  weddingSlug,
  token,
}: {
  weddingSlug: string
  token: string
  requestedCard?: string | null
}): Promise<ResolvedPersonalInvitation | null> {
  const rsvp = await db.rSVP.findUnique({
    where: { token },
    include: {
      guest: {
        include: {
          wedding: {
            select: {
              id: true,
              date: true,
              slug: true,
              title: true,
              privacy: true,
              invitationCardStyle: true,
            },
          },
        },
      },
    },
  })

  if (
    !rsvp ||
    rsvp.guest.wedding.slug !== weddingSlug ||
    rsvp.guest.wedding.privacy === 'private'
  ) {
    return null
  }

  return {
    weddingId: rsvp.guest.wedding.id,
    weddingDate: rsvp.guest.wedding.date,
    weddingSlug: rsvp.guest.wedding.slug,
    weddingTitle: rsvp.guest.wedding.title,
    guestId: rsvp.guest.id,
    rsvpToken: rsvp.token,
    // The wedding's saved style is authoritative. Personal links can be long-lived,
    // so a stale or edited card query must not resurrect an obsolete design.
    card: normalizeInvitationCardStyle(rsvp.guest.wedding.invitationCardStyle),
  }
}
