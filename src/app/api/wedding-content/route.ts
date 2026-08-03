import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-gate'
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
    const slug = request.nextUrl.searchParams.get('slug')?.trim() || 'charity-and-kudzie'
    const access = await resolveWeddingAccessForRequest(request, slug)
    if (!access.allowed) {
      return noStore(
        NextResponse.json(weddingAccessErrorPayload(access), { status: access.status }),
      )
    }

    const wedding = await db.wedding.findUnique({
      where: { slug },
      include: {
        couple: {
          select: {
            id: true,
            slug: true,
            partner1: true,
            partner2: true,
            surname: true,
            photo: true,
            subscriptionStatus: true,
          },
        },
        contentItems: true,
      },
    })

    if (!wedding) {
      return noStore(
        NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 }),
      )
    }

    const content: Record<string, Record<string, string>> = {}
    const contentMeta: Record<string, Record<string, string | null>> = {}
    const ordered: Record<
      string,
      Array<{ field: string; value: string; order: number; metadata: string | null }>
    > = {}

    for (const row of wedding.contentItems) {
      if (!content[row.section]) content[row.section] = {}
      if (!contentMeta[row.section]) contentMeta[row.section] = {}
      content[row.section][row.field] = row.value
      contentMeta[row.section][row.field] = row.metadata
      if (/^([a-z]+)-(\d+)$/.test(row.field)) {
        if (!ordered[row.section]) ordered[row.section] = []
        ordered[row.section].push({
          field: row.field,
          value: row.value,
          order: row.order,
          metadata: row.metadata,
        })
      }
    }

    for (const rows of Object.values(ordered)) {
      rows.sort((a, b) =>
        a.order === b.order
          ? a.field.localeCompare(b.field, undefined, { numeric: true })
          : a.order - b.order,
      )
    }

    return noStore(
      NextResponse.json({
        success: true,
        data: {
          wedding: {
            id: wedding.id,
            slug: wedding.slug,
            title: wedding.title,
            monogram: wedding.monogram,
            tagline: wedding.tagline,
            date: wedding.date,
            venue: wedding.venue,
            venueCity: wedding.venueCity,
            venueCountry: wedding.venueCountry,
            venueMapUrl: wedding.venueMapUrl,
            lifecycle: wedding.lifecycle,
            privacy: wedding.privacy,
            canonSealed: wedding.canonSealed,
            subscriptionTier: wedding.subscriptionTier,
            theme: {
              primaryColor: wedding.primaryColor,
              accentColor: wedding.accentColor,
              memoryColor: wedding.memoryColor,
              backgroundColor: wedding.backgroundColor,
            },
            couple: wedding.couple,
          },
          content,
          contentMeta,
          ordered,
        },
      }),
    )
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
  const denied = requireAdmin(request)
  if (denied) return denied

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

    const wedding = await db.wedding.findUnique({ where: { slug }, select: { id: true } })
    if (!wedding) {
      return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })
    }

    let metadata: string | null = null
    if (body?.metadata != null) {
      metadata =
        typeof body.metadata === 'string'
          ? body.metadata
          : JSON.stringify(body.metadata)
    }

    await db.weddingContent.upsert({
      where: { weddingId_section_field: { weddingId: wedding.id, section, field } },
      update: {
        value: typeof body?.value === 'string' ? body.value : '',
        order: typeof body?.order === 'number' ? Math.max(0, Math.floor(body.order)) : 0,
        metadata,
      },
      create: {
        weddingId: wedding.id,
        section,
        field,
        value: typeof body?.value === 'string' ? body.value : '',
        order: typeof body?.order === 'number' ? Math.max(0, Math.floor(body.order)) : 0,
        metadata,
      },
    })

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
