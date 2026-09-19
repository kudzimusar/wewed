import { NextRequest, NextResponse } from 'next/server'
import { resolveWeddingAccessForRequest } from '@/lib/wedding-public-access'

interface Params {
  params: Promise<{ slug: string }>
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const resolution = await resolveWeddingAccessForRequest(request, slug)

  if (!resolution.wedding) {
    return noStore(
      NextResponse.json(
        { success: false, authorized: false, error: 'Wedding not found.' },
        { status: 404 },
      ),
    )
  }

  const sharedPhysicalInvitation =
    resolution.allowed &&
    resolution.wedding.privacy === 'link_only' &&
    resolution.accessKind === 'public' &&
    resolution.guest === null

  if (!sharedPhysicalInvitation) {
    return noStore(
      NextResponse.json(
        {
          success: false,
          authorized: false,
          error: 'Shared physical invitation access is not active.',
        },
        { status: 401 },
      ),
    )
  }

  return noStore(
    NextResponse.json({
      success: true,
      authorized: true,
      wedding: { slug: resolution.wedding.slug },
    }),
  )
}
