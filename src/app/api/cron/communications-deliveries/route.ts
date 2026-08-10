import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { processQueuedCommunicationDeliveries } from '@/lib/communication-channels'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DEFAULT_BATCH_LIMIT = 20

function cronAuthorized(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || !authorization) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const provided = Buffer.from(authorization)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Communications cron is not configured.' },
      { status: 503 },
    )
  }

  if (!cronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 })
  }

  const result = await processQueuedCommunicationDeliveries(DEFAULT_BATCH_LIMIT)
  return NextResponse.json({ success: true, data: result })
}
