import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { backfillLegacySiteItems } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string }> }

/**
 * QRO07: copy earlier list-style website content (story moments, FAQ, travel, party, guide, venue,
 * registry cards) into editable site items. Idempotent, and every imported item is HIDDEN from
 * guests until an editor reviews and publishes it — nothing unverified goes live by importing.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  try {
    return noStoreJson({ success: true, data: await backfillLegacySiteItems(auth.weddingId) })
  } catch (error) {
    return siteErrorResponse(error, 'site legacy import')
  }
}
