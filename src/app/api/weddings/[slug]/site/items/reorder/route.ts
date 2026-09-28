import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { reorderItems } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string }> }

/** Reorder one section's items. Body: { section, ids: [...] } — ids must be exactly that section's items. */
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  const body = (await request.json().catch(() => null)) as { section?: unknown; ids?: unknown } | null
  try {
    await reorderItems(auth.weddingId, body?.section, body?.ids)
    return noStoreJson({ success: true })
  } catch (error) {
    return siteErrorResponse(error, 'site item reorder')
  }
}
