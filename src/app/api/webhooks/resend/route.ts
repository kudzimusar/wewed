import { NextRequest, NextResponse } from 'next/server'
import { recordResendWebhook, verifyResendWebhook } from '@/lib/email/resend-webhook'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const payload = await request.text()

  try {
    const event = verifyResendWebhook({
      payload,
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    })

    const result = await recordResendWebhook({
      webhookId: request.headers.get('svix-id') as string,
      event,
    })

    return NextResponse.json({ success: true, duplicate: result.duplicate })
  } catch (error) {
    console.error('[webhooks/resend] Rejected webhook:', error)
    return NextResponse.json({ success: false, error: 'Invalid webhook.' }, { status: 400 })
  }
}
