import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import {
  getWeddingMediaGovernance,
  ingestWeddingMedia,
  mediaGovernanceAllowsAccess,
  Phase5MediaError,
} from '@/lib/media/phase5'
import { VaultUploadError } from '@/lib/vault/core'
import {
  resolveWeddingAccessForRequest,
  weddingAccessErrorPayload,
  weddingSlugFromRequest,
} from '@/lib/wedding-public-access'

const MOMENT_VALUES = new Set(['ceremony', 'reception', 'candid', 'preparation', 'group_photo'])

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function governedError(error: unknown): NextResponse {
  if (error instanceof Phase5MediaError || error instanceof VaultUploadError) {
    return noStore(NextResponse.json({ success: false, error: error.message }, { status: error.status }))
  }
  console.error('[MEDIA] Error:', error)
  return noStore(NextResponse.json({ success: false, error: 'Failed to complete the wedding media operation.' }, { status: 500 }))
}

async function accessForRequest(request: NextRequest, explicit?: string | null) {
  const slug = weddingSlugFromRequest(request, explicit)
  if (!slug) {
    return {
      access: null,
      error: noStore(NextResponse.json({ success: false, error: 'Wedding route context is required.' }, { status: 400 })),
    }
  }
  const access = await resolveWeddingAccessForRequest(request, slug)
  if (!access.allowed || !access.wedding) {
    return {
      access: null,
      error: noStore(NextResponse.json(weddingAccessErrorPayload(access), { status: access.status })),
    }
  }
  return { access, error: null }
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await accessForRequest(request)
    if (resolved.error) return resolved.error

    const { searchParams } = request.nextUrl
    const moment = searchParams.get('moment')
    const type = searchParams.get('type')
    const curated = searchParams.get('curated')
    const limit = searchParams.get('limit')
      ? Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 12))
      : undefined
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

    const where: Record<string, unknown> = { weddingId: resolved.access.wedding.id }
    if (moment && MOMENT_VALUES.has(moment)) where.moment = moment
    if (type && ['photo', 'video', 'document'].includes(type)) where.type = type
    if (curated === 'true') where.isCurated = true
    if (curated === 'false') where.isCurated = false

    const [media, governance] = await Promise.all([
      db.mediaItem.findMany({
        where,
        orderBy: [{ isHero: 'desc' }, { uploadedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      getWeddingMediaGovernance(resolved.access.wedding.id),
    ])

    const visible = media.filter((item) => mediaGovernanceAllowsAccess(governance.get(item.id) ?? null, resolved.access.accessKind))

    return noStore(NextResponse.json({
      success: true,
      source: 'database',
      count: visible.length,
      data: visible.map((item) => {
        const governed = governance.get(item.id)
        return {
          ...item,
          uploadedAt: item.uploadedAt?.toISOString() ?? null,
          mediaGovernance: governed ? {
            provenanceState: governed.provenanceState,
            publicationState: governed.publicationState,
            privacyState: governed.privacyState,
            archiveState: governed.archiveState,
          } : { provenanceState: 'LEGACY_EXTERNAL' },
        }
      }),
    }))
  } catch (error) {
    return governedError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const explicitSlug = (form.get('slug') as string | null)?.trim() || null
    const resolved = await accessForRequest(request, explicitSlug)
    if (resolved.error) return resolved.error

    if (resolved.access.accessKind === 'public') {
      return noStore(NextResponse.json(
        { success: false, error: 'Open your personal invitation before uploading wedding media.' },
        { status: 403 },
      ))
    }

    const file = form.get('file')
    const caption = (form.get('caption') as string | null)?.trim() || null
    const rawMoment = (form.get('moment') as string | null)?.trim() || null
    if (!file || !(file instanceof File)) {
      return noStore(NextResponse.json({ success: false, error: 'A file is required.' }, { status: 400 }))
    }

    const moment = rawMoment && MOMENT_VALUES.has(rawMoment) ? rawMoment : 'candid'
    const sourceType = resolved.access.accessKind === 'invited_guest'
      ? 'GUEST'
      : resolved.access.accessKind === 'couple_owner'
        ? 'COUPLE'
        : 'PLANNER'
    const actorId = resolved.access.guest?.id ?? readAppSession(request)?.userId ?? null

    const media = await ingestWeddingMedia({
      weddingId: resolved.access.wedding.id,
      actorId,
      uploaderId: resolved.access.guest?.id ?? null,
      sourceType,
      file,
      caption,
      moment,
    })

    return noStore(NextResponse.json({ success: true, media }, { status: 201 }))
  } catch (error) {
    return governedError(error)
  }
}
