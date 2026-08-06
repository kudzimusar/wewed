import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const REQUEST_TYPES = new Set([
  'correction',
  'duplicate',
  'privacy',
  'removal',
  'closed_business',
  'other',
])

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function optionalEmail(value: unknown): string | null {
  const normalized = text(value, 180).toLowerCase()
  if (!normalized) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

function optionalHttpsUrl(value: unknown): string | null {
  const normalized = text(value, 1000)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ success: false, error: 'Invalid report request.' }, { status: 400 })
    }

    const requestType = text(body.requestType, 40)
    const reporterName = text(body.reporterName, 160) || null
    const reporterEmail = optionalEmail(body.reporterEmail)
    const fieldKey = text(body.fieldKey, 120) || null
    const currentValue = text(body.currentValue, 1000) || null
    const suggestedValue = text(body.suggestedValue, 1000) || null
    const reason = text(body.reason, 2500)
    const evidenceUrl = optionalHttpsUrl(body.evidenceUrl)

    if (!REQUEST_TYPES.has(requestType) || !reason) {
      return NextResponse.json(
        { success: false, error: 'Select a report type and explain the requested change.' },
        { status: 400 },
      )
    }
    if (body.reporterEmail && !reporterEmail) {
      return NextResponse.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 })
    }
    if (body.evidenceUrl && !evidenceUrl) {
      return NextResponse.json({ success: false, error: 'Evidence link must be a valid HTTPS URL.' }, { status: 400 })
    }

    const profiles = await db.$queryRawUnsafe<Array<{ id: string; displayName: string }>>(
      `SELECT id, "displayName"
       FROM wewed_admin."ProviderProfile"
       WHERE slug = $1 AND visibility = 'published'
       LIMIT 1`,
      slug,
    )
    const profile = profiles[0]
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Business listing not found.' }, { status: 404 })
    }

    const reportId = `provider-report-${randomUUID()}`
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."ProviderCorrectionRequest" (
         id, "providerProfileId", "requestType", "reporterName", "reporterEmail",
         "fieldKey", "currentValue", "suggestedValue", reason, "evidenceUrl",
         status, "createdAt", "updatedAt"
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )`,
      reportId,
      profile.id,
      requestType,
      reporterName,
      reporterEmail,
      fieldKey,
      currentValue,
      suggestedValue,
      reason,
      evidenceUrl,
    )

    return NextResponse.json(
      {
        success: true,
        reference: reportId,
        businessName: profile.displayName,
        message: requestType === 'removal'
          ? 'Removal request received for review.'
          : 'Your report has been added to the Wewed data-quality review queue.',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[providers/corrections] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to submit the listing report.' },
      { status: 500 },
    )
  }
}
