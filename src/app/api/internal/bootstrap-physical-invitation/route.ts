import { NextResponse } from 'next/server'

/**
 * Historical one-time physical invitation bootstrap route.
 * Retired under Phase 12 single-tenant remediation (Invariant 5).
 * Performs zero database mutations and returns 410 Gone.
 */
export async function GET() {
  return new NextResponse(null, {
    status: 410,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

export async function POST() {
  return new NextResponse(null, {
    status: 410,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

