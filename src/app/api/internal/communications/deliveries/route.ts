import { NextRequest } from 'next/server'
import {
  communicationDispatchAuthorized,
  processQueuedCommunicationDeliveries,
} from '@/lib/communication-channels'
import { communicationJson } from '@/lib/communications-route'

export async function POST(request: NextRequest) {
  if (!communicationDispatchAuthorized(request.headers.get('x-wewed-communications-dispatch-key'))) {
    return communicationJson({ success: false, error: 'Not found.' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const limit = typeof body.limit === 'number' ? body.limit : 20
  const result = await processQueuedCommunicationDeliveries(limit)
  return communicationJson({ success: true, data: result })
}