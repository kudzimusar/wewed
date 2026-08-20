import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import {
  disablePushSubscription,
  pushSubscriptionInputSchema,
  registerPushSubscription,
} from '@/lib/notifications/push-subscriptions'

export async function POST(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const input = pushSubscriptionInputSchema.parse(await request.json())
    const subscription = await registerPushSubscription(
      session,
      input,
      request.headers.get('user-agent'),
    )
    return NextResponse.json({ success: true, id: subscription.id })
  } catch (error) {
    console.error('[push subscriptions POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to register push subscription.' },
      { status: 400 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { endpoint?: unknown }
    if (typeof body.endpoint !== 'string') {
      return NextResponse.json({ success: false, error: 'Push endpoint is required.' }, { status: 400 })
    }
    const disabled = await disablePushSubscription(session, body.endpoint)
    return NextResponse.json({ success: true, disabled })
  } catch (error) {
    console.error('[push subscriptions DELETE] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to disable push subscription.' },
      { status: 400 },
    )
  }
}
