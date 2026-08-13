import 'server-only'

import { db } from '@/lib/db'
import type {
  WeddingContent,
  WeddingData,
  WeddingContentMap,
} from '@/lib/wedding-data'

/**
 * Load the public wedding-site projection directly from PostgreSQL.
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
      contentItems: true,
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
    if (!content[row.section]) content[row.section] = {}
    if (!contentMeta[row.section]) contentMeta[row.section] = {}

    content[row.section][row.field] = row.value
    contentMeta[row.section][row.field] = row.metadata

    if (/^([a-z]+)-(\d+)$/.test(row.field)) {
      if (!ordered[row.section]) ordered[row.section] = []
      ordered[row.section].push({
        field: row.field,
        value: row.value,
        order: row.order,
        metadata: row.metadata,
      })
    }
  }

  for (const rows of Object.values(ordered)) {
    rows.sort((a, b) =>
      a.order === b.order
        ? a.field.localeCompare(b.field, undefined, { numeric: true })
        : a.order - b.order,
    )
  }

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
  }
}
