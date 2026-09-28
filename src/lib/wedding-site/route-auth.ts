import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission, type WeddingContext } from '@/lib/wedding-access'
import { SiteConflictError, SiteValidationError } from '@/lib/wedding-site/server'

export function noStoreJson(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

/**
 * QRO07 — every website-editing route: a server-verified app session whose active wedding is THIS
 * slug's wedding, with content.edit. A browser "admin" flag is never consulted.
 */
export async function authorizeSiteEditor(
  request: NextRequest,
  slug: string,
): Promise<{ context: WeddingContext; weddingId: string; error: null } | { context: null; weddingId: null; error: NextResponse }> {
  const access = await requireWeddingPermission(request, 'content.edit')
  if (access.error) return { context: null, weddingId: null, error: access.error }
  const wedding = await db.wedding.findUnique({ where: { slug }, select: { id: true } })
  if (!wedding) return { context: null, weddingId: null, error: noStoreJson({ success: false, error: 'Wedding not found.' }, 404) }
  if (wedding.id !== access.context.weddingId) {
    return { context: null, weddingId: null, error: noStoreJson({ success: false, error: 'This wedding is not your active wedding.' }, 403) }
  }
  return { context: access.context, weddingId: wedding.id, error: null }
}

export function siteErrorResponse(error: unknown, label: string): NextResponse {
  if (error instanceof SiteConflictError) {
    return noStoreJson({ success: false, code: 'CONFLICT', error: 'This was changed elsewhere. Review the latest version and try again.', current: error.current }, 409)
  }
  if (error instanceof SiteValidationError) {
    return noStoreJson({ success: false, error: error.message }, 400)
  }
  console.error(`[wewed] ${label} failed`, { name: error instanceof Error ? error.name : 'unknown' })
  return noStoreJson({ success: false, error: 'Something went wrong. Please try again.' }, 500)
}
