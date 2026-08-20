import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import {
  getNotificationPreferences,
  notificationPreferenceInputSchema,
  saveNotificationPreferences,
} from '@/lib/notifications/preferences'

function serializePreference(preference: Awaited<ReturnType<typeof getNotificationPreferences>>) {
  return {
    ...preference,
    createdAt: preference.createdAt.toISOString(),
    updatedAt: preference.updatedAt.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const scopeKey = request.nextUrl.searchParams.get('scopeKey')?.trim() || 'global'
    const preference = await getNotificationPreferences(session, scopeKey)
    return NextResponse.json({ success: true, data: serializePreference(preference) })
  } catch (error) {
    console.error('[notification preferences GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to load notification preferences.' },
      { status: 400 },
    )
  }
}

export async function PUT(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const input = notificationPreferenceInputSchema.parse(await request.json())
    const preference = await saveNotificationPreferences(session, input)
    return NextResponse.json({ success: true, data: serializePreference(preference) })
  } catch (error) {
    console.error('[notification preferences PUT] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to save notification preferences.' },
      { status: 400 },
    )
  }
}
