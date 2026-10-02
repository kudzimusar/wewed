import { NextRequest, NextResponse } from 'next/server'
import { buildAndroidInvitationIntentUrl } from '@/lib/invitation-links'
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
  const entry = await prepareInvitationMobileEntry(request, slug, 'android-open-app-click')

  if (!entry.ok) {
    return redirect(
      entry.reason === 'invalid'
        ? '/guest-access-help?reason=invalid-invitation'
        : '/guest-access-help?reason=install-invitation-missing',
    )
  }

  // Without deferred identity transport we cannot safely invent Guest context for a native launch.
  // Send the guest to Play instead; after install they can tap the same original invitation again.
  if (!entry.deferred || !entry.appResumePath) {
    return redirect(entry.playStoreUrl)
  }

  return redirect(
    buildAndroidInvitationIntentUrl({
      origin: request.nextUrl.origin,
      appResumePath: entry.appResumePath,
      fallbackUrl: entry.playStoreUrl,
    }),
  )
}
