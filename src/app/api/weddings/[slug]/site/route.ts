import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { loadEditorSite } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string }> }

/** QRO07 — the owner/planner editor view: every section, draft and unpublished item. */
export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  try {
    return noStoreJson({ success: true, data: await loadEditorSite(auth.weddingId) })
  } catch (error) {
    return siteErrorResponse(error, 'site editor read')
  }
}
