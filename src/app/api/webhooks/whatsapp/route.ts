import { NextRequest, NextResponse } from 'next/server'
import {
  applyCommunicationProviderStatus,
  ingestInboundCommunicationReply,
} from '@/lib/communication-channels'
import { CommunicationError } from '@/lib/communications'
import {
  normalizeWhatsAppWebhookPayload,
  verifyWhatsAppWebhookSignature,
  verifyWhatsAppWebhookToken,
} from '@/lib/whatsapp-cloud-webhook'

export const dynamic = 'force-dynamic'

const WHATSAPP_PROVIDER = 'meta-whatsapp-cloud'

export async function GET(request: NextRequest) {
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()
  if (!expectedToken) {
    return NextResponse.json({ success: false, error: 'WhatsApp webhook is not configured.' }, { status: 503 })
  }

  const mode = request.nextUrl.searchParams.get('hub.mode')
  const verifyToken = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !challenge || !verifyWhatsAppWebhookToken(verifyToken)) {
    return NextResponse.json({ success: false, error: 'Webhook verification rejected.' }, { status: 403 })
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: NextRequest) {
  if (!process.env.WHATSAPP_WEBHOOK_APP_SECRET?.trim()) {
    return NextResponse.json({ success: false, error: 'WhatsApp webhook is not configured.' }, { status: 503 })
  }

  const rawBody = await request.text()
  if (!verifyWhatsAppWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ success: false, error: 'Invalid webhook signature.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody) as unknown
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid webhook payload.' }, { status: 400 })
  }

  const normalized = normalizeWhatsAppWebhookPayload(payload)

  for (const event of normalized.statuses) {
    await applyCommunicationProviderStatus({
      provider: WHATSAPP_PROVIDER,
      channel: 'WHATSAPP',
      providerEventId: event.providerEventId,
      providerMessageId: event.providerMessageId,
      status: event.status,
      metadata: event.metadata,
    })
  }

  let ingestedInboundCount = 0
  let ignoredInboundCount = normalized.ignoredInboundCount
  for (const reply of normalized.inboundReplies) {
    try {
      await ingestInboundCommunicationReply({
        provider: WHATSAPP_PROVIDER,
        channel: 'WHATSAPP',
        providerEventId: reply.providerEventId,
        fromAddress: reply.fromAddress,
        replyToProviderMessageId: reply.replyToProviderMessageId,
        body: reply.body,
      })
      ingestedInboundCount += 1
    } catch (error) {
      if (error instanceof CommunicationError && (error.status === 400 || error.status === 404)) {
        ignoredInboundCount += 1
        continue
      }
      throw error
    }
  }

  return NextResponse.json({
    success: true,
    statuses: normalized.statuses.length,
    inboundReplies: ingestedInboundCount,
    ignoredInbound: ignoredInboundCount,
  })
}
