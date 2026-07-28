/**
 * wewed — Resolve the flagship wedding id.
 * The flagship slug is "charity-and-kudzie" — same convention
 * as every other planner API route. Extracted to a helper so
 * the import/export routes don't each duplicate the lookup.
 */

import { db } from '@/lib/db'

const FLAGSHIP_SLUG = 'charity-and-kudzie'

export async function getFlagshipWeddingId(): Promise<string | null> {
  const w = await db.wedding.findFirst({
    where: { slug: FLAGSHIP_SLUG },
    select: { id: true },
  })
  return w?.id ?? null
}
