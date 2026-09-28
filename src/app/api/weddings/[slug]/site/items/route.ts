import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { createItem } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string }> }

/** Add a website item (unpublished unless `enabled: true`). */
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  try {
    return noStoreJson({ success: true, data: await createItem(auth.weddingId, body as never) }, 201)
  } catch (error) {
    return siteErrorResponse(error, 'site item create')
  }
}
