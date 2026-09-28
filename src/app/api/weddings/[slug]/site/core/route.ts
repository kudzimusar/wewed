import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { updateCoreFacts } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string }> }

/**
 * Core wedding facts — couple names, date, venue, tagline, monogram — edited at their single
 * authority (Couple/Wedding), so web, iOS and Android render the same values.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  try {
    return noStoreJson({ success: true, data: await updateCoreFacts(auth.weddingId, body) })
  } catch (error) {
    return siteErrorResponse(error, 'core facts update')
  }
}
