/**
 * QRO07-SHIP01 — the wedding-website data model shared by server and client.
 *
 * Canonical authority (never duplicated as site copy):
 *   couple names  → Couple.partner1 / Couple.partner2
 *   date          → Wedding.date
 *   venue         → Wedding.venue / venueCity / venueCountry / venueMapUrl
 *   tagline       → Wedding.tagline      monogram → Wedding.monogram
 *   programme     → ProgrammeItem        media    → MediaItem
 *   contributions → wewed_contributions.campaigns
 *   announcements → WeddingAnnouncement
 *
 * Site-specific presentation copy (headings, prose) lives in WeddingContent and reaches guests only
 * through PUBLIC_SCALAR_FIELDS. Repeating website structures live in WeddingSiteItem and reach
 * guests only when enabled. Everything else in WeddingContent (team invites, AI documents,
 * planner worksheet order, RSVP policy, legacy hero duplicates) is server-private.
 */

export const SITE_SECTION_KEYS = [
  'story',
  'party',
  'venue',
  'theday',
  'rsvp',
  'travel',
  'guide',
  'gifts',
  'gallery',
  'songbook',
  'wall',
  'village',
  'faq',
  'share',
] as const
export type SiteSectionKey = (typeof SITE_SECTION_KEYS)[number]

export function isSiteSectionKey(value: unknown): value is SiteSectionKey {
  return typeof value === 'string' && (SITE_SECTION_KEYS as readonly string[]).includes(value)
}

export const SITE_SECTION_LABELS: Record<SiteSectionKey, string> = {
  story: 'Our Story',
  party: 'Wedding Party',
  venue: 'Venue',
  theday: 'The Day',
  rsvp: 'RSVP',
  travel: 'Travel & Stay',
  guide: 'Guest Guide',
  gifts: 'Gifts & Contributions',
  gallery: 'Gallery',
  songbook: 'Songbook',
  wall: 'Guest Wall',
  village: 'Our Village',
  faq: 'Questions & Answers',
  share: 'Share',
}

/** Which repeating item kinds belong to which section. */
export const SITE_ITEM_KINDS = {
  story_milestone: 'story',
  party_profile: 'party',
  venue_feature: 'venue',
  venue_moment: 'venue',
  travel_card: 'travel',
  guide_entry: 'guide',
  registry_card: 'gifts',
  faq_item: 'faq',
} as const satisfies Record<string, SiteSectionKey>
export type SiteItemKind = keyof typeof SITE_ITEM_KINDS

export function isSiteItemKind(value: unknown): value is SiteItemKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SITE_ITEM_KINDS, value)
}

/**
 * The only WeddingContent fields a guest may receive. Anything not listed never leaves the server.
 * Core facts (names, date, venue, tagline, monogram) are deliberately absent: they come from
 * Couple/Wedding so web, iOS and Android can never disagree.
 */
export const PUBLIC_SCALAR_FIELDS: Readonly<Record<string, readonly string[]>> = {
  hero: ['imageUrl'],
  story: ['heading', 'subtitle', 'title', 'body', 'introduction', 'familyTitle', 'familyNames', 'familyImageUrl'],
  party: ['heading', 'subtitle'],
  venue: ['heading', 'subtitle', 'description', 'imageUrl'],
  theday: ['heading', 'dressCode', 'dressCodeNote', 'venueDescription'],
  travel: ['heading', 'subtitle'],
  guide: ['heading', 'subtitle'],
  registry: ['heading', 'subtitle', 'culturalNote'],
  gallery: ['heading', 'subtitle'],
  songbook: ['heading', 'subtitle'],
  wall: ['welcomeMessage'],
  faq: ['heading', 'subtitle'],
  social: ['telegramUrl', 'telegramHandle'],
  after: ['heading', 'highlightVideoUrl'],
}

export function isPublicScalarField(section: string, field: string): boolean {
  return PUBLIC_SCALAR_FIELDS[section]?.includes(field) ?? false
}

export interface PublicSiteSection {
  key: SiteSectionKey
  enabled: boolean
  order: number
  layoutVariant: string | null
}

export interface PublicSiteItem {
  id: string
  kind: SiteItemKind
  title: string
  body: string | null
  url: string | null
  media: { id: string; url: string; thumbnailUrl: string | null; caption: string | null } | null
  metadata: Record<string, unknown>
  order: number
}

export interface EditorSiteItem extends PublicSiteItem {
  sectionKey: SiteSectionKey
  enabled: boolean
  updatedAt: string
}

export interface PublicAnnouncement {
  id: string
  title: string
  body: string
  publishedAt: string | null
  expiresAt: string | null
  order: number
}

export interface EditorAnnouncement extends PublicAnnouncement {
  status: AnnouncementStatus
  audience: AnnouncementAudience
  updatedAt: string
}

export const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'archived'] as const
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number]
export const ANNOUNCEMENT_AUDIENCES = ['guests', 'attending'] as const
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number]

export interface PublicSiteStructure {
  sections: PublicSiteSection[]
  /** Enabled items only, grouped by section key, in order. */
  items: Partial<Record<SiteSectionKey, PublicSiteItem[]>>
}

/** Default section order when a wedding has not customised it. */
export function defaultSectionOrder(key: SiteSectionKey): number {
  return SITE_SECTION_KEYS.indexOf(key) * 10
}

/** Merge stored section rows over defaults so every key is present, then sort. */
export function resolveSections(
  rows: Array<{ key: string; enabled: boolean; order: number; layoutVariant: string | null }>,
): PublicSiteSection[] {
  const byKey = new Map(rows.filter((row) => isSiteSectionKey(row.key)).map((row) => [row.key, row]))
  return SITE_SECTION_KEYS.map((key) => {
    const row = byKey.get(key)
    return {
      key,
      enabled: row ? row.enabled : true,
      order: row ? row.order : defaultSectionOrder(key),
      layoutVariant: row?.layoutVariant ?? null,
    }
  }).sort((a, b) => (a.order === b.order ? SITE_SECTION_KEYS.indexOf(a.key) - SITE_SECTION_KEYS.indexOf(b.key) : a.order - b.order))
}
