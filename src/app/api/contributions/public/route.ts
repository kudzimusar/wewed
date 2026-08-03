import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  resolveWeddingAccessForRequest,
  weddingAccessErrorPayload,
  weddingSlugFromRequest,
} from '@/lib/wedding-public-access'

interface PublicContribution {
  id: string
  type: string
  displayName: string
  relationship: string | null
  message: string
  photoUrl: string | null
  favoriteSong: string | null
  privacy: string
  isFeatured: boolean
  submittedAt: string | null
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export async function GET(request: NextRequest) {
  try {
    const slug = weddingSlugFromRequest(request)
    if (!slug) {
      return noStore(
        NextResponse.json(
          { success: false, error: 'Wedding route context is required.' },
          { status: 400 },
        ),
      )
    }

    const access = await resolveWeddingAccessForRequest(request, slug)
    if (!access.allowed || !access.wedding) {
      return noStore(
        NextResponse.json(weddingAccessErrorPayload(access), {
          status: access.status,
        }),
      )
    }

    const rows = await db.guestContribution.findMany({
      where: {
        weddingId: access.wedding.id,
        status: { in: ['approved', 'featured'] },
        privacy: { not: 'couple_only' },
      },
      select: {
        id: true,
        type: true,
        displayName: true,
        relationship: true,
        message: true,
        photoUrl: true,
        favoriteSong: true,
        privacy: true,
        status: true,
        submittedAt: true,
      },
      orderBy: [{ submittedAt: 'desc' }],
    })

    const data: PublicContribution[] = rows
      .map((row) => ({
        id: row.id,
        type: row.type,
        displayName:
          row.privacy === 'anonymous' ? 'Anonymous' : row.displayName,
        relationship:
          row.privacy === 'anonymous' ? null : row.relationship,
        message: row.message,
        photoUrl: row.privacy === 'anonymous' ? null : row.photoUrl,
        favoriteSong:
          row.privacy === 'anonymous' ? null : row.favoriteSong,
        privacy: row.privacy,
        isFeatured: row.status === 'featured',
        submittedAt: row.submittedAt?.toISOString() ?? null,
      }))
      .sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1
        return (
          new Date(b.submittedAt ?? 0).getTime() -
          new Date(a.submittedAt ?? 0).getTime()
        )
      })

    return noStore(
      NextResponse.json({ success: true, count: data.length, data }),
    )
  } catch (error) {
    console.error('[CONTRIBUTIONS PUBLIC GET] Error:', error)
    return noStore(
      NextResponse.json(
        { success: false, error: 'Unable to load wedding contributions.' },
        { status: 500 },
      ),
    )
  }
}
