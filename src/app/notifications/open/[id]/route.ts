import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import {
  NotificationAccessError,
  NotificationNotFoundError,
  setNotificationReadState,
} from '@/lib/notifications/service'

function safeDestination(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/notifications'
  return value
}

function relativeRedirect(destination: string, status = 303): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { Location: destination },
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = readAppSession(request)
  if (!session) {
    const next = encodeURIComponent(request.nextUrl.pathname)
    return relativeRedirect(`/sign-in?next=${next}`)
  }

  try {
    const { id } = await context.params
    const notificationId = id?.trim()
    if (!notificationId) return relativeRedirect('/notifications')

    // setNotificationReadState performs the live recipient/wedding/source authorization check.
    // Acknowledged and terminal states stay unchanged while their existing read timestamp is preserved.
    const notification = await setNotificationReadState(session, notificationId, true)
    // Keep the redirect origin-relative. This prevents proxy/internal bind hosts from turning a
    // same-site notification action into a cross-origin RSC request while still restricting
    // destinations to Wewed paths through safeDestination().
    return relativeRedirect(safeDestination(notification.deepLink))
  } catch (error) {
    if (error instanceof NotificationNotFoundError || error instanceof NotificationAccessError) {
      return relativeRedirect('/notifications')
    }
    console.error('[notification open] Error:', error)
    return relativeRedirect('/notifications')
  }
}
