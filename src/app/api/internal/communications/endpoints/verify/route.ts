import { NextRequest } from 'next/server'
import {
  communicationDispatchAuthorized,
  verifyCommunicationEndpoint,
} from '@/lib/communication-channels'
import { communicationJson } from '@/lib/communications-route'

export async function POST(request: NextRequest) {
  if (!communicationDispatchAuthorized(request.headers.get('x-wewed-communications-dispatch-key'))) {
    return communicationJson({ success: false, error: 'Not found.' }, { status: 404 })
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (typeof body.endpointId !== 'string' || !body.endpointId.trim()) {
    return communicationJson({ success: false, error: 'endpointId is required.' }, { status: 400 })
  }
  const result = await verifyCommunicationEndpoint(body.endpointId.trim())
  return communicationJson({ success: true, data: result })
}