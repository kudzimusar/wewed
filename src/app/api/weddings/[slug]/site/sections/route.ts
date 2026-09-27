import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { updateSections } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string }> }

/** Enable/disable and reorder website sections. Body: { sections: [{ key, enabled?, order?, layoutVariant? }] } */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  const body = (await request.json().catch(() => null)) as { sections?: unknown } | null
  try {
    return noStoreJson({ success: true, data: await updateSections(auth.weddingId, body?.sections as never) })
  } catch (error) {
    return siteErrorResponse(error, 'site sections update')
  }
}
