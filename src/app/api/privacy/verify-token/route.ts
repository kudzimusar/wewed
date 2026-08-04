import { NextResponse } from 'next/server'

/**
 * Legacy shared-token endpoint.
 *
 * Wedding access now uses guest-specific invitation credentials exchanged by
 * `/api/weddings/[slug]/guest-session` into signed HttpOnly sessions. A shared
 * wedding token cannot authorize access and is intentionally retired.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      valid: false,
      code: 'legacy_shared_token_retired',
      error:
        'Use the guest-specific QR code or invitation link issued for this wedding.',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  )
}
