import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { marketplaceAudit, marketplaceId, requireCoupleMarketplace, stringList, text } from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'
import { providerServiceFields } from '@/lib/provider-catalog'

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function nullableInteger(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) throw new Error('A numeric enquiry value is outside the allowed range.')
  return number
}

function structuredAnswers(category: string, value: unknown): Record<string, unknown> {
  const source = objectValue(value)
  const output: Record<string, unknown> = {}
  for (const field of providerServiceFields(category)) {
    const raw = source[field.key]
    if (raw === undefined || raw === null || raw === '') continue
    if (field.type === 'checkboxes' || field.type === 'multiselect') {
      output[field.key] = stringList(raw, 50)
    } else if (field.type === 'number') {
      output[field.key] = nullableInteger(raw, field.min ?? 0, field.max ?? 1000000)
    } else if (field.type === 'boolean') {
      output[field.key] = raw === true || raw === 'true'
    } else {
      output[field.key] = text(raw, field.type === 'textarea' ? 3000 : 300)
    }
  }
  return output
}

export async function POST(request: NextRequest) {
  try {
    const couple = await requireCoupleMarketplace(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ success: false, error: 'Invalid provider enquiry.' }, { status: 400 })

    const offeringId = text(body.offeringId, 180)
    if (!offeringId) return NextResponse.json({ success: false, error: 'A provider service is required.' }, { status: 400 })

    const rows = await db.$queryRawUnsafe<Array<{
      offeringId: string
      category: string
      providerBusinessAccountId: string
      providerName: string
    }>>(
      `SELECT
         o.id AS "offeringId",
         o.category,
         o."businessAccountId" AS "providerBusinessAccountId",
         p."displayName" AS "providerName"
       FROM public."ProviderServiceOffering" o
       JOIN public."ProviderProfile" p
         ON p."businessAccountId" = o."businessAccountId"
        AND p.visibility = 'published'
       JOIN public."BusinessAccount" ba
         ON ba.id = o."businessAccountId"
        AND ba.type IN ('venue', 'vendor')
        AND ba.status = 'active'
        AND ba."onboardingStatus" = 'complete'
       WHERE o.id = $1 AND o.status = 'published'
       LIMIT 1`,
      offeringId,
    )
    const offering = rows[0]
    if (!offering) return NextResponse.json({ success: false, error: 'This provider service is not available for enquiries.' }, { status: 404 })

    const eventDateRaw = text(body.eventDate, 40)
    const eventDate = eventDateRaw ? new Date(eventDateRaw) : null
    if (eventDate && Number.isNaN(eventDate.getTime())) return NextResponse.json({ success: false, error: 'Event date is invalid.' }, { status: 400 })

    const guestCount = nullableInteger(body.guestCount, 0, 100000)
    const message = text(body.message, 3000)
    const location = text(body.location, 300)
    const budgetBand = text(body.budgetBand, 100)
    const contactPreference = text(body.contactPreference, 100)
    const answers = structuredAnswers(offering.category, body.structuredAnswers)
    const share = objectValue(body.sharedSummary)
    const allowedSharedSummary = {
      weddingTitle: share.weddingTitle === true,
      weddingDate: share.weddingDate === true,
      location: share.location === true,
      guestCount: share.guestCount === true,
      budgetBand: share.budgetBand === true,
    }

    const enquiryId = marketplaceId('provider-enquiry')
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."ProviderEnquiry" (
         id, "offeringId", "providerBusinessAccountId", "weddingId", "coupleBusinessAccountId", "createdByUserId",
         status, "eventDate", location, "guestCount", "budgetBand", "contactPreference", "structuredAnswers", "sharedSummary", message
       ) VALUES ($1,$2,$3,$4,$5,$6,'sent',$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14)`,
      enquiryId,
      offering.offeringId,
      offering.providerBusinessAccountId,
      couple.weddingId,
      couple.coupleBusinessAccountId,
      couple.user.id,
      eventDate,
      location,
      guestCount,
      budgetBand,
      contactPreference,
      JSON.stringify(answers),
      JSON.stringify(allowedSharedSummary),
      message,
    )

    await marketplaceAudit({
      actorUserId: couple.user.id,
      businessAccountId: offering.providerBusinessAccountId,
      action: 'provider_enquiry.sent',
      resourceType: 'provider_enquiry',
      resourceId: enquiryId,
      details: {
        offeringId: offering.offeringId,
        category: offering.category,
        weddingId: couple.weddingId,
        sharedSummary: allowedSharedSummary,
        authorityCreated: false,
      },
    })

    return NextResponse.json({
      success: true,
      enquiryId,
      providerName: offering.providerName,
      status: 'sent',
      authorityCreated: false,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'A numeric enquiry value is outside the allowed range.') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return marketplaceErrorResponse(error)
  }
}

export const dynamic = 'force-dynamic'
