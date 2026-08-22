import { NextRequest, NextResponse } from 'next/server'
import { processQueuedCommunicationDeliveries } from '@/lib/communication-channels'
import { processQueuedCommunicationPushDeliveries } from '@/lib/communication-push-delivery'
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

  const [endpointDeliveries, pushDeliveries] = await Promise.all([
    processQueuedCommunicationDeliveries(DEFAULT_BATCH_LIMIT),
    processQueuedCommunicationPushDeliveries(DEFAULT_BATCH_LIMIT),
  ])
  return NextResponse.json({
    success: true,
    data: {
      processed: endpointDeliveries.processed + pushDeliveries.processed,
      deliveries: [...endpointDeliveries.deliveries, ...pushDeliveries.deliveries],
      endpointDeliveries,
      pushDeliveries,
    },
  })
}
