import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession } from '@/lib/app-session'
import {
  archiveMediaItem,
  getMediaGovernance,
  mediaGovernanceAllowsAccess,
  Phase5MediaError,
  updateManagedMediaPresentation,
  type MediaPrivacyState,
  type MediaPublicationState,
} from '@/lib/media/phase5'
import { resolveWeddingAccessForRequest, weddingAccessErrorPayload } from '@/lib/wedding-public-access'

const MOMENT_VALUES = new Set(['ceremony', 'reception', 'candid', 'preparation', 'group_photo'])
const PUBLICATION_VALUES = new Set<MediaPublicationState>(['PRIVATE', 'PUBLISHED', 'UNPUBLISHED'])
const PRIVACY_VALUES = new Set<MediaPrivacyState>(['PRIVATE', 'WEDDING_MEMBERS', 'INVITED_GUESTS', 'PUBLIC'])
const RIGHTS_VALUES = new Set(['UNKNOWN', 'DECLARED_AUTHORIZED', 'LICENSED', 'CONSENTED', 'RESTRICTED'])
const MODERATION_VALUES = new Set(['PENDING', 'APPROVED', 'REJECTED', 'NOT_REQUIRED'])

interface MediaPatch {
  caption?: string | null
  moment?: string | null
  isCurated?: boolean
  isHero?: boolean
  publicationState?: MediaPublicationState
  privacyState?: MediaPrivacyState
  rightsState?: 'UNKNOWN' | 'DECLARED_AUTHORIZED' | 'LICENSED' | 'CONSENTED' | 'RESTRICTED'
  moderationState?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED'
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof Phase5MediaError) {
    return noStore(NextResponse.json({ success: false, error: error.message, field: error.field }, { status: error.status }))
  }
  console.error('[MEDIA ID] Error:', error)
  return noStore(NextResponse.json({ success: false, error: 'Failed to complete the wedding media operation.' }, { status: 500 }))
}

async function resolveMediaAccess(request: NextRequest, id: string) {
  const media = await db.mediaItem.findUnique({
    where: { id },
    include: { wedding: { select: { slug: true } } },
  })
  if (!media) {
    return { media: null, access: null, error: noStore(NextResponse.json({ success: false, error: 'Media not found.' }, { status: 404 })) }
  }
  const access = await resolveWeddingAccessForRequest(request, media.wedding.slug)
  if (!access.allowed || !access.wedding) {
    return { media: null, access: null, error: noStore(NextResponse.json(weddingAccessErrorPayload(access), { status: access.status })) }
  }
  return { media, access, error: null }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const resolved = await resolveMediaAccess(request, id)
    if (resolved.error) return resolved.error
    const governance = await getMediaGovernance(id)
    if (!mediaGovernanceAllowsAccess(governance, resolved.access.accessKind)) {
      return noStore(NextResponse.json({ success: false, error: 'Media is not available for this audience.' }, { status: 404 }))
    }
    return noStore(NextResponse.json({
      success: true,
      media: {
        ...resolved.media,
        uploadedAt: resolved.media.uploadedAt?.toISOString() ?? null,
        mediaGovernance: governance ? {
          provenanceState: governance.provenanceState,
          publicationState: governance.publicationState,
          privacyState: governance.privacyState,
          rightsState: governance.rightsState,
          moderationState: governance.moderationState,
          archiveState: governance.archiveState,
        } : { provenanceState: 'LEGACY_EXTERNAL' },
      },
    }))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const resolved = await resolveMediaAccess(request, id)
    if (resolved.error) return resolved.error
    if (resolved.access.accessKind !== 'couple_owner' && resolved.access.accessKind !== 'wedding_member') {
      return noStore(NextResponse.json({ success: false, error: 'Only authorized wedding members can manage media presentation.' }, { status: 403 }))
    }

    const body = await request.json() as MediaPatch
    const updateData: Record<string, unknown> = {}
    if (body.caption !== undefined) updateData.caption = body.caption === null ? null : body.caption.trim().slice(0, 500) || null
    if (body.moment !== undefined) {
      if (body.moment === null || body.moment === '') updateData.moment = null
      else if (MOMENT_VALUES.has(body.moment)) updateData.moment = body.moment
      else return noStore(NextResponse.json({ success: false, error: `Invalid moment. Allowed: ${[...MOMENT_VALUES].join(', ')}` }, { status: 400 }))
    }
    if (typeof body.isCurated === 'boolean') updateData.isCurated = body.isCurated
    if (typeof body.isHero === 'boolean') updateData.isHero = body.isHero

    if (body.publicationState && !PUBLICATION_VALUES.has(body.publicationState)) {
      return noStore(NextResponse.json({ success: false, error: 'Invalid publication state.' }, { status: 400 }))
    }
    if (body.privacyState && !PRIVACY_VALUES.has(body.privacyState)) {
      return noStore(NextResponse.json({ success: false, error: 'Invalid media privacy state.' }, { status: 400 }))
    }
    if (body.rightsState && !RIGHTS_VALUES.has(body.rightsState)) {
      return noStore(NextResponse.json({ success: false, error: 'Invalid media rights state.' }, { status: 400 }))
    }
    if (body.moderationState && !MODERATION_VALUES.has(body.moderationState)) {
      return noStore(NextResponse.json({ success: false, error: 'Invalid media moderation state.' }, { status: 400 }))
    }

    const actorId = readAppSession(request)?.userId
    if (!actorId) return noStore(NextResponse.json({ success: false, error: 'Authenticated actor identity is required.' }, { status: 401 }))

    const updated = await db.$transaction(async (tx) => tx.mediaItem.update({ where: { id }, data: updateData }))
    let governance = await getMediaGovernance(id)
    if (body.publicationState || body.privacyState || body.rightsState || body.moderationState) {
      governance = await updateManagedMediaPresentation({
        mediaItemId: id,
        weddingId: resolved.access.wedding.id,
        actorId,
        publicationState: body.publicationState,
        privacyState: body.privacyState,
        rightsState: body.rightsState,
        moderationState: body.moderationState,
      })
    }

    return noStore(NextResponse.json({
      success: true,
      media: { ...updated, uploadedAt: updated.uploadedAt?.toISOString() ?? null, mediaGovernance: governance },
    }))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const resolved = await resolveMediaAccess(request, id)
    if (resolved.error) return resolved.error
    if (resolved.access.accessKind !== 'couple_owner' && resolved.access.accessKind !== 'wedding_member') {
      return noStore(NextResponse.json({ success: false, error: 'Only authorized wedding members can archive media.' }, { status: 403 }))
    }
    const actorId = readAppSession(request)?.userId
    if (!actorId) return noStore(NextResponse.json({ success: false, error: 'Authenticated actor identity is required.' }, { status: 401 }))
    const result = await archiveMediaItem({ mediaItemId: id, weddingId: resolved.access.wedding.id, actorId })
    return noStore(NextResponse.json({ success: true, ...result }))
  } catch (error) {
    return errorResponse(error)
  }
}
