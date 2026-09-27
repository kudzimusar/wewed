import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isPublicScalarField } from '@/lib/wedding-site/model'
import { publishScalar } from '@/lib/wedding-site/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { loadWeddingDataBySlug } from '@/lib/wedding-data-server'
import {
  resolveWeddingAccessForRequest,
  weddingAccessErrorPayload,
} from '@/lib/wedding-public-access'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug')?.trim()
    if (!slug) {
      return noStore(
        NextResponse.json({ success: false, error: 'Wedding slug is required.' }, { status: 400 }),
      )
    }
    const access = await resolveWeddingAccessForRequest(request, slug)
    if (!access.allowed) {
      return noStore(
        NextResponse.json(weddingAccessErrorPayload(access), { status: access.status }),
      )
    }

    const data = await loadWeddingDataBySlug(slug)
    if (!data) {
      return noStore(
        NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 }),
      )
    }

    return noStore(NextResponse.json({ success: true, data }))
  } catch (error) {
    console.error('[WEDDING-CONTENT GET] Error:', error)
    return noStore(
      NextResponse.json(
        { success: false, error: 'Failed to fetch wedding content.' },
        { status: 500 },
      ),
    )
  }
}

interface PostBody {
  slug?: string
  section?: string
  field?: string
  value?: string
  order?: number
  metadata?: string | Record<string, unknown> | null
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'content.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json().catch(() => null)) as PostBody | null
    const slug = body?.slug?.trim()
    const section = body?.section?.trim()
    const field = body?.field?.trim()
    if (!slug || !section || !field) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: slug, section, field.' },
        { status: 400 },
      )
    }

    const wedding = await db.wedding.findUnique({
      where: { slug },
      select: { id: true, coupleId: true },
    })
    if (!wedding) {
      return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })
    }

    if (wedding.id !== access.context.weddingId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden — this account cannot edit this wedding.' },
        { status: 403 },
      )
    }

    // QRO07: only public site copy may be written here, and it is PUBLISHED through the same
    // transactional lifecycle as the site editor (revision recorded, WeddingContent materialized).
    // Private sections and core facts (names/date/venue live on Couple/Wedding) are refused.
    if (!isPublicScalarField(section, field)) {
      return NextResponse.json(
        { success: false, error: 'That field is not editable site copy.' },
        { status: 400 },
      )
    }
    await publishScalar(
      wedding.id,
      access.context.session.userId ?? null,
      section,
      field,
      typeof body?.value === 'string' ? body.value : '',
      undefined,
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WEDDING-CONTENT POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save wedding content.' },
      { status: 500 },
    )
  }
}

export const dynamic = 'force-dynamic'
