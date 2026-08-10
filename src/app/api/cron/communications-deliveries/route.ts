import { NextRequest, NextResponse } from 'next/server'
import { processQueuedCommunicationDeliveries } from '@/lib/communication-channels'
import { communicationSchedulerAuthorized } from '@/lib/communications-scheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DEFAULT_BATCH_LIMIT = 20

export async function POST(request: NextRequest) {
  let authorized = false
  try {
    authorized = await communicationSchedulerAuthorized(request.headers.get('authorization'))
  } catch {
    return NextResponse.json(
      { success: false, error: 'Communications scheduler authorization is unavailable.' },
      { status: 503 },
    )
  }

  if (!authorized) {
    return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 })
  }

  const result = await processQueuedCommunicationDeliveries(DEFAULT_BATCH_LIMIT)
  return NextResponse.json({ success: true, data: result })
}
