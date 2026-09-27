import 'server-only'

import { db } from '@/lib/db'
import { isPublicScalarField } from '@/lib/wedding-site/model'
import { loadPublicSiteStructure, loadPublishedAnnouncements } from '@/lib/wedding-site/server'
import type {
  WeddingContent,
  WeddingData,
  WeddingContentMap,
} from '@/lib/wedding-data'

/**
 * Load the public wedding-site projection directly from PostgreSQL.
 *
 * QRO07-SHIP01: this projection is what Guests receive, so it is built from an ALLOWLIST. Only
 * public site copy (PUBLIC_SCALAR_FIELDS) leaves the server — team invites, AI documents, planner
 * worksheet state, RSVP policy rows and the legacy hero/day duplicates of core facts never do.
 * Repeating structures come from enabled WeddingSiteItem rows; announcements from the published
 * WeddingAnnouncement projection shared with native Wedding Day.
 *
 * This is the single read model used by both the server-rendered wedding page
 * and the wedding-content API. Keeping the projection here prevents the page
 * from rendering neutral placeholders first and replacing them after client
 * hydration, while also preventing the API and SSR paths from drifting.
 */
export async function loadWeddingDataBySlug(slug: string): Promise<WeddingData | null> {
  const wedding = await db.wedding.findUnique({
    where: { slug },
    include: {
      couple: {
        select: {
          id: true,
          slug: true,
          partner1: true,
          partner2: true,
          surname: true,
          photo: true,
          subscriptionStatus: true,
        },
      },
      contentItems: {
        select: { section: true, field: true, value: true, metadata: true },
      },
      programmeItems: {
        orderBy: [{ order: 'asc' }, { time: 'asc' }],
        select: {
          id: true,
          time: true,
          title: true,
          description: true,
          icon: true,
          duration: true,
          location: true,
          displayIcon: true,
          order: true,
        },
      },
      songs: {
        orderBy: [{ order: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          title: true,
          artist: true,
          phase: true,
          moment: true,
          order: true,
          votes: true,
          spotifyUrl: true,
          appleUrl: true,
          playedAt: true,
          notes: true,
        },
      },
    },
  })

  if (!wedding) return null

  const content: WeddingContentMap = {}
  const contentMeta: Record<string, Record<string, string | null>> = {}
  const ordered: Record<string, WeddingContent[]> = {}

  for (const row of wedding.contentItems) {
    if (!isPublicScalarField(row.section, row.field)) continue
    if (!row.value.trim()) continue
    ;(content[row.section] ??= {})[row.field] = row.value
    ;(contentMeta[row.section] ??= {})[row.field] = row.metadata
  }

  const [site, announcements] = await Promise.all([
    loadPublicSiteStructure(wedding.id),
    loadPublishedAnnouncements(wedding.id, { includeAttendingOnly: false }),
  ])

  return {
    wedding: {
      id: wedding.id,
      slug: wedding.slug,
      title: wedding.title,
      monogram: wedding.monogram,
      tagline: wedding.tagline,
      date: wedding.date.toISOString(),
      venue: wedding.venue,
      venueCity: wedding.venueCity,
      venueCountry: wedding.venueCountry,
      venueMapUrl: wedding.venueMapUrl,
      lifecycle: wedding.lifecycle,
      privacy: wedding.privacy,
      canonSealed: wedding.canonSealed,
      subscriptionTier: wedding.subscriptionTier,
      theme: {
        primaryColor: wedding.primaryColor,
        accentColor: wedding.accentColor,
        memoryColor: wedding.memoryColor,
        backgroundColor: wedding.backgroundColor,
      },
      couple: wedding.couple,
    },
    content,
    contentMeta,
    ordered,
    programmeItems: wedding.programmeItems.map((item) => ({
      ...item,
    })),
    songs: wedding.songs.map((song) => ({
      ...song,
      playedAt: song.playedAt ? song.playedAt.toISOString() : null,
    })),
    site,
    announcements,
  }
}
