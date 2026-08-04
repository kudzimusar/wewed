import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  resolveWeddingAccessForRequest,
  weddingAccessErrorPayload,
  weddingSlugFromRequest,
} from '@/lib/wedding-public-access'

interface SongRequestPayload {
  title?: unknown
  artist?: unknown
  phase?: unknown
  moment?: unknown
  slug?: unknown
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

async function accessForRequest(request: NextRequest, explicit?: unknown) {
  const slug = weddingSlugFromRequest(
    request,
    typeof explicit === 'string' ? explicit : null,
  )
  if (!slug) {
    return {
      slug: null,
      access: null,
      error: noStore(
        NextResponse.json(
          { success: false, error: 'Wedding route context is required.' },
          { status: 400 },
        ),
      ),
    }
  }
  const access = await resolveWeddingAccessForRequest(request, slug)
  if (!access.allowed || !access.wedding) {
    return {
      slug,
      access: null,
      error: noStore(
        NextResponse.json(weddingAccessErrorPayload(access), {
          status: access.status,
        }),
      ),
    }
  }
  return { slug, access, error: null }
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await accessForRequest(request)
    if (resolved.error) return resolved.error

    const songs = await db.song.findMany({
      where: { weddingId: resolved.access.wedding.id },
      orderBy: [{ order: 'asc' }, { title: 'asc' }],
    })

    return noStore(
      NextResponse.json({
        success: true,
        source: 'database',
        count: songs.length,
        data: songs,
      }),
    )
  } catch (error) {
    console.error('[SONGS GET] Error:', error)
    return noStore(
      NextResponse.json(
        { success: false, error: 'Failed to load wedding songs.' },
        { status: 500 },
      ),
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as SongRequestPayload | null
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const artist = typeof body?.artist === 'string' ? body.artist.trim() : ''

    if (!title || !artist) {
      return NextResponse.json(
        { success: false, error: 'Song title and artist are required.' },
        { status: 400 },
      )
    }

    const resolved = await accessForRequest(request, body?.slug)
    if (resolved.error) return resolved.error

    const maxOrder = await db.song.aggregate({
      where: { weddingId: resolved.access.wedding.id },
      _max: { order: true },
    })

    const song = await db.song.create({
      data: {
        title,
        artist,
        phase:
          typeof body?.phase === 'string' && body.phase.trim()
            ? body.phase.trim()
            : 'requested',
        moment:
          typeof body?.moment === 'string' && body.moment.trim()
            ? body.moment.trim()
            : null,
        order: (maxOrder._max.order ?? 0) + 1,
        votes: 1,
        weddingId: resolved.access.wedding.id,
      },
    })

    return NextResponse.json({ success: true, data: song }, { status: 201 })
  } catch (error) {
    console.error('[SONGS POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add song request.' },
      { status: 500 },
    )
  }
}
