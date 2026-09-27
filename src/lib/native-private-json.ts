import { NextResponse } from 'next/server'

/**
 * No-store JSON for native responses that carry credential-bearing data (for example Guest
 * invitation URLs, which embed the Guest's private RSVP credential). Never cacheable by any shared
 * or private cache, and varied on the Bearer authority that authorized it.
 */
export function privateNoStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'cache-control': 'private, no-store, max-age=0', vary: 'Authorization' },
  })
}
