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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = readAppSession(request)
  if (!session) {
    const signIn = new URL('/sign-in', request.url)
    signIn.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(signIn)
  }

  try {
    const { id } = await context.params
    const notificationId = id?.trim()
    if (!notificationId) return NextResponse.redirect(new URL('/notifications', request.url))

    // setNotificationReadState performs the live recipient/wedding/source authorization check.
    // Acknowledged and terminal states stay unchanged while their existing read timestamp is preserved.
    const notification = await setNotificationReadState(session, notificationId, true)
    return NextResponse.redirect(new URL(safeDestination(notification.deepLink), request.url), 303)
  } catch (error) {
    if (error instanceof NotificationNotFoundError || error instanceof NotificationAccessError) {
      return NextResponse.redirect(new URL('/notifications', request.url), 303)
    }
    console.error('[notification open] Error:', error)
    return NextResponse.redirect(new URL('/notifications', request.url), 303)
  }
}
