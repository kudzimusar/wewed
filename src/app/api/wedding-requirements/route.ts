import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { normalizeWeddingRequirements } from '@/lib/wedding-requirements'

interface RequirementProfileRow {
  id: string
  weddingId: string
  totalBudgetCents: string | null
  currency: string
  contingencyBasisPoints: number | null
  budgetFlexibilityBasisPoints: number | null
  guestCount: number | null
  adultCount: number | null
  childCount: number | null
  dateFlexibilityDays: number | null
  country: string | null
  city: string | null
  locationRadiusKm: number | null
  ceremonyType: string | null
  receptionType: string | null
  strategy: string
  styleTags: unknown
  culturalRequirements: unknown
  paymentConstraints: unknown
  notes: string | null
  completionScore: number
  confirmedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface CategoryRequirementRow {
  id: string
  weddingId: string
  category: string
  priority: string
  requirements: unknown
  notes: string | null
  confirmedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function readRequirements(weddingId: string) {
  const [wedding, profileRows, categories] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        venue: true,
        venueCity: true,
        venueCountry: true,
      },
    }),
    db.$queryRawUnsafe<RequirementProfileRow[]>(
      `SELECT id, "weddingId", "totalBudgetCents"::text AS "totalBudgetCents", currency,
              "contingencyBasisPoints", "budgetFlexibilityBasisPoints", "guestCount",
              "adultCount", "childCount", "dateFlexibilityDays", country, city,
              "locationRadiusKm", "ceremonyType", "receptionType", strategy,
              "styleTags", "culturalRequirements", "paymentConstraints", notes,
              "completionScore", "confirmedAt", "createdAt", "updatedAt"
       FROM wewed_admin."WeddingRequirementProfile"
       WHERE "weddingId"=$1
       LIMIT 1`,
      weddingId,
    ),
    db.$queryRawUnsafe<CategoryRequirementRow[]>(
      `SELECT id, "weddingId", category, priority, requirements, notes,
              "confirmedAt", "createdAt", "updatedAt"
       FROM wewed_admin."WeddingCategoryRequirement"
       WHERE "weddingId"=$1
       ORDER BY category ASC`,
      weddingId,
    ),
  ])

  if (!wedding) return null
  const profile = profileRows[0] ?? null
  return {
    wedding: {
      ...wedding,
      date: wedding.date.toISOString(),
    },
    profile: profile
      ? {
          totalBudgetCents: profile.totalBudgetCents === null ? null : Number(profile.totalBudgetCents),
          totalBudget: profile.totalBudgetCents === null ? '' : (Number(profile.totalBudgetCents) / 100).toFixed(2),
          currency: profile.currency,
          contingencyPercent: profile.contingencyBasisPoints === null ? '' : profile.contingencyBasisPoints / 100,
          budgetFlexibilityPercent: profile.budgetFlexibilityBasisPoints === null ? '' : profile.budgetFlexibilityBasisPoints / 100,
          guestCount: profile.guestCount,
          adultCount: profile.adultCount,
          childCount: profile.childCount,
          dateFlexibilityDays: profile.dateFlexibilityDays,
          country: profile.country,
          city: profile.city,
          locationRadiusKm: profile.locationRadiusKm,
          ceremonyType: profile.ceremonyType,
          receptionType: profile.receptionType,
          strategy: profile.strategy,
          styleTags: jsonArray(profile.styleTags),
          culturalRequirements: jsonArray(profile.culturalRequirements),
          paymentConstraints: jsonObject(profile.paymentConstraints),
          notes: profile.notes,
          completionScore: profile.completionScore,
          confirmedAt: profile.confirmedAt?.toISOString() ?? null,
          updatedAt: profile.updatedAt.toISOString(),
        }
      : null,
    categories: categories.map((entry) => ({
      category: entry.category,
      priority: entry.priority,
      requirements: jsonObject(entry.requirements),
      notes: entry.notes,
      confirmedAt: entry.confirmedAt?.toISOString() ?? null,
      updatedAt: entry.updatedAt.toISOString(),
    })),
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const result = await readRequirements(access.context.weddingId)
    if (!result) {
      return NextResponse.json({ success: false, error: 'Active wedding was not found.' }, { status: 404 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[WEDDING REQUIREMENTS] Read failed:', error)
    return NextResponse.json({ success: false, error: 'Wedding requirements are temporarily unavailable.' }, { status: 503 })
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  let normalized
  try {
    normalized = normalizeWeddingRequirements(await request.json())
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Invalid wedding requirements.' },
      { status: 400 },
    )
  }

  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    const before = await readRequirements(weddingId)
    const profile = normalized.profile

    await db.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."WeddingRequirementProfile" (
           id,"weddingId","totalBudgetCents",currency,"contingencyBasisPoints",
           "budgetFlexibilityBasisPoints","guestCount","adultCount","childCount",
           "dateFlexibilityDays",country,city,"locationRadiusKm","ceremonyType",
           "receptionType",strategy,"styleTags","culturalRequirements","paymentConstraints",
           notes,"completionScore","confirmedAt","createdByUserId","updatedByUserId","updatedAt"
         ) VALUES (
           gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
           $16::jsonb,$17::jsonb,$18::jsonb,$19,$20,CASE WHEN $21 THEN CURRENT_TIMESTAMP ELSE NULL END,
           $22,$22,CURRENT_TIMESTAMP
         )
         ON CONFLICT ("weddingId") DO UPDATE SET
           "totalBudgetCents"=EXCLUDED."totalBudgetCents",
           currency=EXCLUDED.currency,
           "contingencyBasisPoints"=EXCLUDED."contingencyBasisPoints",
           "budgetFlexibilityBasisPoints"=EXCLUDED."budgetFlexibilityBasisPoints",
           "guestCount"=EXCLUDED."guestCount",
           "adultCount"=EXCLUDED."adultCount",
           "childCount"=EXCLUDED."childCount",
           "dateFlexibilityDays"=EXCLUDED."dateFlexibilityDays",
           country=EXCLUDED.country,
           city=EXCLUDED.city,
           "locationRadiusKm"=EXCLUDED."locationRadiusKm",
           "ceremonyType"=EXCLUDED."ceremonyType",
           "receptionType"=EXCLUDED."receptionType",
           strategy=EXCLUDED.strategy,
           "styleTags"=EXCLUDED."styleTags",
           "culturalRequirements"=EXCLUDED."culturalRequirements",
           "paymentConstraints"=EXCLUDED."paymentConstraints",
           notes=EXCLUDED.notes,
           "completionScore"=EXCLUDED."completionScore",
           "confirmedAt"=CASE WHEN $21 THEN CURRENT_TIMESTAMP ELSE NULL END,
           "updatedByUserId"=$22,
           "updatedAt"=CURRENT_TIMESTAMP`,
        weddingId,
        profile.totalBudgetCents,
        profile.currency,
        profile.contingencyBasisPoints,
        profile.budgetFlexibilityBasisPoints,
        profile.guestCount,
        profile.adultCount,
        profile.childCount,
        profile.dateFlexibilityDays,
        profile.country,
        profile.city,
        profile.locationRadiusKm,
        profile.ceremonyType,
        profile.receptionType,
        profile.strategy,
        JSON.stringify(profile.styleTags),
        JSON.stringify(profile.culturalRequirements),
        JSON.stringify(profile.paymentConstraints),
        profile.notes,
        profile.completionScore,
        profile.confirmBrief,
        actorId,
      )

      await transaction.$executeRawUnsafe(
        `DELETE FROM wewed_admin."WeddingCategoryRequirement" WHERE "weddingId"=$1`,
        weddingId,
      )
      for (const category of normalized.categories) {
        await transaction.$executeRawUnsafe(
          `INSERT INTO wewed_admin."WeddingCategoryRequirement" (
             id,"weddingId",category,priority,requirements,notes,"confirmedAt","updatedByUserId","updatedAt"
           ) VALUES (
             gen_random_uuid()::text,$1,$2,$3,$4::jsonb,$5,
             CASE WHEN $6 THEN CURRENT_TIMESTAMP ELSE NULL END,$7,CURRENT_TIMESTAMP
           )`,
          weddingId,
          category.category,
          category.priority,
          JSON.stringify(category.requirements),
          category.notes,
          profile.confirmBrief,
          actorId,
        )
      }

      await transaction.auditEvent.create({
        data: {
          action: profile.confirmBrief ? 'wedding.requirements.confirmed' : 'wedding.requirements.saved',
          resourceType: 'wedding_requirements',
          resourceId: weddingId,
          beforeValue: before ? JSON.stringify(before) : null,
          afterValue: JSON.stringify(normalized),
          weddingId,
          actorId,
        },
      })
    })

    const result = await readRequirements(weddingId)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[WEDDING REQUIREMENTS] Save failed:', error)
    return NextResponse.json({ success: false, error: 'Unable to save wedding requirements.' }, { status: 503 })
  }
}

export const dynamic = 'force-dynamic'
