import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { deleteAnnouncement, updateAnnouncement } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string; announcementId: string }> }

/** Edit, publish, archive or unpublish an announcement. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, announcementId } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  try {
    return noStoreJson({ success: true, data: await updateAnnouncement(auth.weddingId, announcementId, body) })
  } catch (error) {
    return siteErrorResponse(error, 'announcement update')
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug, announcementId } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  try {
    await deleteAnnouncement(auth.weddingId, announcementId)
    return noStoreJson({ success: true })
  } catch (error) {
    return siteErrorResponse(error, 'announcement delete')
  }
}
