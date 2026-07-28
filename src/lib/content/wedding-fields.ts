/**
 * wewed — Content editing helpers
 * ============================================================
 * Maps a (section, fieldKey) tuple to a Wedding model field
 * so that when a ContentRevision is published, the live Wedding
 * row can be kept in sync.
 *
 * Sections that don't map to a Wedding column (e.g. "our-story"
 * prose blocks) are stored purely as ContentRevisions and the
 * public site reads them via GET /api/content?section=...&status=published.
 */

import { db } from '@/lib/db'

/**
 * The canonical flagship slug — same convention as every other
 * planner API route.
 */
const FLAGSHIP_SLUG = 'charity-and-kudzie'

/**
 * Mapping of `${section}.${fieldKey}` → Wedding model field name.
 * Only fields that have a direct 1:1 representation on the Wedding
 * model live here. Everything else stays revision-only.
 */
const WEDDING_FIELD_MAP: Record<string, string> = {
  'wedding.title': 'title',
  'wedding.tagline': 'tagline',
  'wedding.monogram': 'monogram',
  'wedding.venue': 'venue',
  'wedding.venueCity': 'venueCity',
  'wedding.venueCountry': 'venueCountry',
  'wedding.venueMapUrl': 'venueMapUrl',
  'wedding.primaryColor': 'primaryColor',
  'wedding.accentColor': 'accentColor',
  'wedding.memoryColor': 'memoryColor',
  'wedding.backgroundColor': 'backgroundColor',
}

/** Wedding.date is a DateTime — needs to be parsed from an ISO string. */
const WEDDING_DATE_KEY = 'wedding.date'

/** Resolve the flagship wedding id (cached per request). */
export async function getFlagshipWeddingId(): Promise<string | null> {
  const w = await db.wedding.findFirst({
    where: { slug: FLAGSHIP_SLUG },
    select: { id: true },
  })
  return w?.id ?? null
}

/**
 * Returns true if (section, fieldKey) maps to a Wedding column.
 * Used by the API to decide whether to also update Wedding on publish.
 */
export function mapsToWeddingField(section: string, fieldKey: string): boolean {
  return Boolean(WEDDING_FIELD_MAP[`${section}.${fieldKey}`]) || `${section}.${fieldKey}` === WEDDING_DATE_KEY
}

/**
 * If (section, fieldKey) maps to a Wedding column, write the value
 * to the Wedding row. Otherwise no-op. String values are stored
 * as-is; the special `wedding.date` field is parsed to a DateTime.
 *
 * Returns true if a Wedding row was updated.
 */
export async function syncWeddingField(
  weddingId: string,
  section: string,
  fieldKey: string,
  value: string,
): Promise<boolean> {
  const key = `${section}.${fieldKey}`

  if (key === WEDDING_DATE_KEY) {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return false
    await db.wedding.update({ where: { id: weddingId }, data: { date: parsed } })
    return true
  }

  const column = WEDDING_FIELD_MAP[key]
  if (!column) return false

  // Prisma's update accepts a partial record — cast to keep
  // the helper schema-agnostic. The column names above are vetted.
  await db.wedding.update({
    where: { id: weddingId },
    data: { [column]: value } as Record<string, string>,
  })
  return true
}

/**
 * Valid revision statuses. Mirrors the schema comment.
 */
export const REVISION_STATUSES = [
  'draft',
  'pending',
  'approved',
  'scheduled',
  'published',
  'hidden',
  'rejected',
  'archived',
] as const

export type RevisionStatus = (typeof REVISION_STATUSES)[number]

export function isRevisionStatus(v: string | undefined | null): v is RevisionStatus {
  return Boolean(v) && (REVISION_STATUSES as readonly string[]).includes(v!)
}
