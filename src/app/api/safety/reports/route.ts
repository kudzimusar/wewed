import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import {
  CommunicationError,
  requireCommunicationActor,
  type CommunicationActor,
} from '@/lib/communications'
import { enforceCommunicationRateLimit } from '@/lib/communications-rate-limit'
import {
  communicationErrorResponse,
  communicationJson,
} from '@/lib/communications-route'
import { createAnonymousAiSafetyReport, createSafetyReport } from '@/lib/safety'

function anonymousReporterKey(request: NextRequest): string {
  const network = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  const agent = request.headers.get('user-agent') || 'unknown'
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${day}:${network}:${agent}`).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    let actor: CommunicationActor | null = null
    try {
      actor = await requireCommunicationActor(request)
    } catch (error) {
      if (!(error instanceof CommunicationError) || error.status !== 401) throw error
    }
    const reporterKey = actor?.userId ?? `anonymous:${anonymousReporterKey(request)}`
    await enforceCommunicationRateLimit({ userId: reporterKey, scope: 'safety_report' })
    const result = actor
      ? await createSafetyReport(actor, body)
      : await createAnonymousAiSafetyReport(reporterKey.slice('anonymous:'.length), body)
    return communicationJson({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
