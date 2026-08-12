import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  resolveWeddingAccessForRequest,
  weddingAccessErrorPayload,
  weddingSlugFromRequest,
} from '@/lib/wedding-public-access'

interface MessagePayload {
  type?: unknown
  content?: unknown
  authorName?: unknown
  slug?: unknown
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

async function accessForRequest(request: NextRequest, explicit?: unknown) {
  const slug = weddingSlugFromRequest(request, typeof explicit === 'string' ? explicit : null)
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

    const messages = await db.message.findMany({
      where: { weddingId: resolved.access.wedding.id, isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return noStore(NextResponse.json({ success: true, source: 'database', count: messages.length, data: messages }))
  } catch (error) {
    console.error('[MESSAGES GET] Error:', error)
    return noStore(NextResponse.json({ success: false, error: 'Failed to load wedding messages.' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as MessagePayload | null
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    const submittedName = typeof body?.authorName === 'string' ? body.authorName.trim() : ''

    if (!content) {
      return NextResponse.json({ success: false, error: 'Message content is required.' }, { status: 400 })
    }

    const resolved = await accessForRequest(request, body?.slug)
    if (resolved.error) return resolved.error

    // A public wedding may be readable without identity, but posting is a
    // participant action. Require an invitation session or authenticated
    // wedding membership so arbitrary internet visitors cannot write to it.
    if (resolved.access.accessKind === 'public') {
      return NextResponse.json(
        { success: false, error: 'Open your personal invitation before posting to the wedding wall.' },
        { status: 403 },
      )
    }

    const authorName = resolved.access.guest?.name || submittedName
    if (!authorName) {
      return NextResponse.json({ success: false, error: 'Author name is required.' }, { status: 400 })
    }

    const message = await db.message.create({
      data: {
        type: typeof body?.type === 'string' && body.type.trim() ? body.type.trim() : 'wall',
        content,
        authorName,
        authorToken: resolved.access.guest?.rsvpToken ?? null,
        isPublic: true,
        weddingId: resolved.access.wedding.id,
      },
    })

    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) {
    console.error('[MESSAGES POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to add wedding message.' }, { status: 500 })
  }
}
