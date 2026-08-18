import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveManagedMediaContent } from '@/lib/media/phase5'
import { signedVaultDownload } from '@/lib/vault/core'
import { signedVaultView } from '@/lib/vault/view'
import { resolveWeddingAccessForRequest, weddingAccessErrorPayload } from '@/lib/wedding-public-access'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const variant = request.nextUrl.searchParams.get('variant') === 'thumbnail' ? 'thumbnail' : null
    const content = await resolveManagedMediaContent({ mediaItemId: id, variant })
    if (!content || content.archiveState === 'ARCHIVED') {
      return noStore(NextResponse.json({ success: false, error: 'Managed media was not found.' }, { status: 404 }))
    }

    const wedding = await db.wedding.findUnique({ where: { id: content.weddingId }, select: { slug: true } })
    if (!wedding) return noStore(NextResponse.json({ success: false, error: 'Wedding was not found.' }, { status: 404 }))
    const access = await resolveWeddingAccessForRequest(request, wedding.slug)
    if (!access.allowed || !access.wedding) {
      return noStore(NextResponse.json(weddingAccessErrorPayload(access), { status: access.status }))
    }

    const member = access.accessKind === 'couple_owner' || access.accessKind === 'wedding_member'
    const guest = access.accessKind === 'invited_guest' && (content.privacyState === 'INVITED_GUESTS' || content.privacyState === 'PUBLIC')
    const publicAllowed = access.accessKind === 'public' && content.publicationState === 'PUBLISHED' && content.privacyState === 'PUBLIC'
    if (!member && !guest && !publicAllowed) {
      return noStore(NextResponse.json({ success: false, error: 'Media is not available for this audience.' }, { status: 404 }))
    }

    const distributable = !content.deletedAt && content.storageState === 'stored_private' && content.scanState === 'content_validated'
    if (!distributable) {
      return noStore(NextResponse.json({ success: false, error: 'Media is not available for distribution.' }, { status: 423 }))
    }

    const download = request.nextUrl.searchParams.get('download') === '1'
    const target = download
      ? await signedVaultDownload({ objectKey: content.objectKey, filename: content.filename, distributable })
      : await signedVaultView({ objectKey: content.objectKey, distributable })
    const response = NextResponse.redirect(target, 307)
    response.headers.set('Cache-Control', 'private, no-store, max-age=0')
    response.headers.set('Vary', 'Cookie')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  } catch (error) {
    console.error('[MANAGED MEDIA CONTENT] error:', error)
    return noStore(NextResponse.json({ success: false, error: 'Managed media could not be opened.' }, { status: 500 }))
  }
}
