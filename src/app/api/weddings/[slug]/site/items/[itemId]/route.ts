import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { deleteItem, updateItem } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string; itemId: string }> }

/** Edit, publish (enabled: true) or unpublish an item. `expectedUpdatedAt` guards concurrent edits. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, itemId } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  try {
    return noStoreJson({ success: true, data: await updateItem(auth.weddingId, itemId, body) })
  } catch (error) {
    return siteErrorResponse(error, 'site item update')
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug, itemId } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  try {
    await deleteItem(auth.weddingId, itemId)
    return noStoreJson({ success: true })
  } catch (error) {
    return siteErrorResponse(error, 'site item delete')
  }
}
