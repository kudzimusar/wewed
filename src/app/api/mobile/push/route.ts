import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'

const inputSchema = z.object({
  expoPushToken: z.string().trim().min(16).max(512),
  platform: z.enum(['android', 'ios']),
  deviceId: z.string().trim().min(1).max(512).optional().nullable(),
  appVersion: z.string().trim().min(1).max(80).optional().nullable(),
  buildVersion: z.string().trim().min(1).max(80).optional().nullable(),
})

function looksLikeExpoPushToken(value: string) {
  return /^Expo(?:nent)?PushToken\[[^\]]+\]$/.test(value)
}

export async function POST(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })

  try {
    const input = inputSchema.parse(await request.json())
    if (!looksLikeExpoPushToken(input.expoPushToken)) {
      return NextResponse.json({ success: false, error: 'A valid Expo push token is required.' }, { status: 400 })
    }
    const id = randomUUID()
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO wewed_mobile."NativePushDevice"
        (id, "userId", platform, "expoPushToken", "deviceId", "appVersion", "buildVersion", "activeWeddingId", enabled, "lastSeenAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("expoPushToken") DO UPDATE SET
         "userId" = EXCLUDED."userId",
         platform = EXCLUDED.platform,
         "deviceId" = EXCLUDED."deviceId",
         "appVersion" = EXCLUDED."appVersion",
         "buildVersion" = EXCLUDED."buildVersion",
         "activeWeddingId" = EXCLUDED."activeWeddingId",
         enabled = TRUE,
         "lastSeenAt" = CURRENT_TIMESTAMP,
         "updatedAt" = CURRENT_TIMESTAMP
       RETURNING id`,
      id,
      session.effectiveUserId ?? session.userId,
      input.platform,
      input.expoPushToken,
      input.deviceId ?? null,
      input.appVersion ?? null,
      input.buildVersion ?? null,
      session.activeWeddingId ?? null,
    )
    return NextResponse.json({ success: true, id: rows[0]?.id ?? id })
  } catch (error) {
    console.error('[mobile push POST] Error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to register this device.' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })

  try {
    const body = z.object({ expoPushToken: z.string().trim().min(16).max(512) }).parse(await request.json())
    const disabled = await db.$executeRawUnsafe(
      `UPDATE wewed_mobile."NativePushDevice"
          SET enabled = FALSE, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = $1 AND "expoPushToken" = $2 AND enabled = TRUE`,
      session.effectiveUserId ?? session.userId,
      body.expoPushToken,
    )
    return NextResponse.json({ success: true, disabled: disabled > 0 })
  } catch (error) {
    console.error('[mobile push DELETE] Error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to disable this device.' }, { status: 400 })
  }
}
