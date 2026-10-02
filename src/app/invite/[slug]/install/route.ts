import { NextRequest, NextResponse } from 'next/server'
import { prepareInvitationMobileEntry } from '@/lib/invitation-mobile-entry'

interface Params {
  params: Promise<{ slug: string }>
}

function redirect(location: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const entry = await prepareInvitationMobileEntry(request, slug, 'android-install-click')

  if (!entry.ok) {
    return redirect(
      entry.reason === 'invalid'
        ? '/guest-access-help?reason=invalid-invitation'
        : '/guest-access-help?reason=install-invitation-missing',
    )
  }

  return redirect(entry.playStoreUrl)
}
