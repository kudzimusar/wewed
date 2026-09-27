import type { NextRequest } from 'next/server'
import { authorizeSiteEditor, noStoreJson, siteErrorResponse } from '@/lib/wedding-site/route-auth'
import { publishScalar, saveScalarDraft, unpublishScalar } from '@/lib/wedding-site/server'

interface Params { params: Promise<{ slug: string }> }

/**
 * Site copy lifecycle. Body: { action: 'draft' | 'publish' | 'unpublish', section, field, value?, expectedUpdatedAt? }.
 * 'publish' records the revision and materializes WeddingContent in one transaction, so SSR, the
 * public API and native readers change together.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const auth = await authorizeSiteEditor(request, slug)
  if (auth.error) return auth.error
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const authorId = auth.context.session.userId ?? null
  try {
    if (body.action === 'draft') {
      const draft = await saveScalarDraft(auth.weddingId, authorId, body.section, body.field, body.value)
      return noStoreJson({ success: true, data: { id: draft.id, updatedAt: draft.updatedAt.toISOString() } })
    }
    if (body.action === 'publish') {
      return noStoreJson({ success: true, data: await publishScalar(auth.weddingId, authorId, body.section, body.field, body.value, body.expectedUpdatedAt) })
    }
    if (body.action === 'unpublish') {
      return noStoreJson({ success: true, data: await unpublishScalar(auth.weddingId, authorId, body.section, body.field) })
    }
    return noStoreJson({ success: false, error: 'Unknown action.' }, 400)
  } catch (error) {
    return siteErrorResponse(error, 'site copy')
  }
}
