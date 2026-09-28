import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { createAnnouncement, loadEditorSite } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string }> }

/** Editors: every announcement (drafts included). Guests read the published projection elsewhere. */
export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  try {
    return noStoreJson({ success: true, data: (await loadEditorSite(auth.weddingId)).announcements })
  } catch (error) {
    return siteErrorResponse(error, 'announcements read')
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  try {
    return noStoreJson({ success: true, data: await createAnnouncement(auth.weddingId, body) }, 201)
  } catch (error) {
    return siteErrorResponse(error, 'announcement create')
  }
}
