import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createBusinessId,
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
} from '@/lib/wewed-admin'

export const dynamic = 'force-dynamic'

type AdminAction =
  | 'create_account'
  | 'update_account'
  | 'create_support_case'
  | 'update_support_case'
  | 'create_incident'
  | 'update_incident'
  | 'record_payment'

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function nullableText(value: unknown, max = 2000): string | null {
  const normalized = text(value, max)
  return normalized || null
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  return normalized || 'business-account'
}

function adminError(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }

  console.error('[api/admin/overview] Error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to complete the admin request.' },
    { status: 500 },
  )
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireWewedAdmin(request)

    const [summaryRows, accountRows, supportRows, incidentRows, paymentRows, auditRows] =
      await Promise.all([
        db.$queryRawUnsafe<
          Array<{
            businessAccounts: number
            activeAccounts: number
            couples: number
            weddings: number
            planners: number
            venues: number
            vendors: number
            activeSubscriptions: number
            openSupportCases: number
            openIncidents: number
            paidRevenueCents: number
            pendingRevenueCents: number
          }>
        >(`
          SELECT
            (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type <> 'wewed_internal') AS "businessAccounts",
            (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type <> 'wewed_internal' AND status = 'active') AS "activeAccounts",
            (SELECT COUNT(*)::int FROM public."Couple") AS couples,
            (SELECT COUNT(*)::int FROM public."Wedding") AS weddings,
            (SELECT COUNT(*)::int FROM public."User" WHERE role = 'planner' AND "isActive" = true) AS planners,
            (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type = 'venue') AS venues,
            (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type = 'vendor') AS vendors,
            (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE "subscriptionStatus" IN ('active', 'trialing')) AS "activeSubscriptions",
            (SELECT COUNT(*)::int FROM public."SupportCase" WHERE status NOT IN ('resolved', 'closed')) AS "openSupportCases",
            (SELECT COUNT(*)::int FROM public."PlatformIncident" WHERE status <> 'resolved') AS "openIncidents",
            (SELECT COALESCE(SUM("amountCents"), 0)::double precision FROM public."PaymentRecord" WHERE status = 'paid') AS "paidRevenueCents",
            (SELECT COALESCE(SUM("amountCents"), 0)::double precision FROM public."PaymentRecord" WHERE status IN ('pending', 'due')) AS "pendingRevenueCents"
        `),
        db.$queryRawUnsafe<
          Array<{
            id: string
            name: string
            slug: string
            type: string
            status: string
            ownerUserId: string | null
            ownerEmail: string | null
            onboardingStatus: string
            subscriptionPlan: string
            subscriptionStatus: string
            trialEndsAt: Date | null
            currentPeriodEndsAt: Date | null
            notes: string | null
            memberCount: number
            weddingCount: number
            createdAt: Date
            updatedAt: Date
          }>
        >(`
          SELECT
            ba.id,
            ba.name,
            ba.slug,
            ba.type,
            ba.status,
            ba."ownerUserId",
            owner.email AS "ownerEmail",
            ba."onboardingStatus",
            ba."subscriptionPlan",
            ba."subscriptionStatus",
            ba."trialEndsAt",
            ba."currentPeriodEndsAt",
            ba.notes,
            (SELECT COUNT(*)::int FROM public."BusinessAccountMember" bam WHERE bam."businessAccountId" = ba.id AND bam.status = 'active') AS "memberCount",
            (SELECT COUNT(*)::int FROM public."BusinessAccountLink" bal WHERE bal."businessAccountId" = ba.id AND bal."entityType" = 'wedding') AS "weddingCount",
            ba."createdAt",
            ba."updatedAt"
          FROM public."BusinessAccount" ba
          LEFT JOIN public."User" owner ON owner.id = ba."ownerUserId"
          ORDER BY CASE ba.type
            WHEN 'wewed_internal' THEN 0
            WHEN 'planning_company' THEN 1
            WHEN 'couple' THEN 2
            WHEN 'venue' THEN 3
            WHEN 'vendor' THEN 4
            ELSE 5
          END, ba.name
        `),
        db.$queryRawUnsafe<
          Array<{
            id: string
            businessAccountId: string | null
            businessAccountName: string | null
            title: string
            description: string | null
            category: string
            priority: string
            status: string
            requesterEmail: string | null
            createdAt: Date
            updatedAt: Date
          }>
        >(`
          SELECT sc.id, sc."businessAccountId", ba.name AS "businessAccountName", sc.title,
            sc.description, sc.category, sc.priority, sc.status, sc."requesterEmail",
            sc."createdAt", sc."updatedAt"
          FROM public."SupportCase" sc
          LEFT JOIN public."BusinessAccount" ba ON ba.id = sc."businessAccountId"
          ORDER BY CASE sc.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
            CASE sc.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
            sc."createdAt" DESC
          LIMIT 50
        `),
        db.$queryRawUnsafe<
          Array<{
            id: string
            title: string
            summary: string | null
            status: string
            severity: string
            startedAt: Date
            resolvedAt: Date | null
            createdAt: Date
            updatedAt: Date
          }>
        >(`
          SELECT id, title, summary, status, severity, "startedAt", "resolvedAt", "createdAt", "updatedAt"
          FROM public."PlatformIncident"
          ORDER BY CASE status WHEN 'investigating' THEN 0 WHEN 'monitoring' THEN 1 ELSE 2 END,
            "startedAt" DESC
          LIMIT 30
        `),
        db.$queryRawUnsafe<
          Array<{
            id: string
            businessAccountId: string
            businessAccountName: string
            provider: string
            providerReference: string | null
            type: string
            amountCents: number
            currency: string
            status: string
            dueAt: Date | null
            paidAt: Date | null
            createdAt: Date
          }>
        >(`
          SELECT pr.id, pr."businessAccountId", ba.name AS "businessAccountName", pr.provider,
            pr."providerReference", pr.type, pr."amountCents", pr.currency, pr.status,
            pr."dueAt", pr."paidAt", pr."createdAt"
          FROM public."PaymentRecord" pr
          JOIN public."BusinessAccount" ba ON ba.id = pr."businessAccountId"
          ORDER BY pr."createdAt" DESC
          LIMIT 50
        `),
        db.$queryRawUnsafe<
          Array<{
            id: string
            action: string
            resourceType: string
            resourceId: string | null
            businessAccountName: string | null
            actorEmail: string | null
            details: Record<string, unknown>
            createdAt: Date
          }>
        >(`
          SELECT bal.id, bal.action, bal."resourceType", bal."resourceId",
            ba.name AS "businessAccountName", actor.email AS "actorEmail", bal.details, bal."createdAt"
          FROM public."BusinessAuditLog" bal
          LEFT JOIN public."BusinessAccount" ba ON ba.id = bal."businessAccountId"
          LEFT JOIN public."User" actor ON actor.id = bal."actorUserId"
          ORDER BY bal."createdAt" DESC
          LIMIT 50
        `),
      ])

    return NextResponse.json({
      success: true,
      admin: { email: session.email, role: session.role },
      summary: summaryRows[0],
      accounts: accountRows,
      supportCases: supportRows,
      incidents: incidentRows,
      payments: paymentRows,
      auditLog: auditRows,
    })
  } catch (error) {
    return adminError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireWewedAdmin(request)
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 50) as AdminAction

    if (action === 'create_account') {
      const name = text(body.name, 120)
      const type = text(body.type, 40) || 'client'
      const plan = text(body.subscriptionPlan, 40) || 'free'

      if (!name) {
        return NextResponse.json(
          { success: false, error: 'Business account name is required.' },
          { status: 400 },
        )
      }

      const id = createBusinessId('business')
      const slug = `${slugify(name)}-${id.slice(-8)}`

      await db.$executeRawUnsafe(
        `INSERT INTO public."BusinessAccount"
          ("id", "name", "slug", "type", "status", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "notes")
         VALUES ($1, $2, $3, $4, 'active', 'in_progress', $5, $6, $7)`,
        id,
        name,
        slug,
        type,
        plan,
        plan === 'free' ? 'free' : 'trialing',
        nullableText(body.notes),
      )

      await writeBusinessAudit({
        actorUserId: session.userId,
        businessAccountId: id,
        action: 'business_account.created',
        resourceType: 'BusinessAccount',
        resourceId: id,
        details: { name, type, plan },
      })

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update_account') {
      const id = text(body.id, 120)
      if (!id) {
        return NextResponse.json(
          { success: false, error: 'Business account ID is required.' },
          { status: 400 },
        )
      }

      await db.$executeRawUnsafe(
        `UPDATE public."BusinessAccount"
         SET
           status = COALESCE($2, status),
           "onboardingStatus" = COALESCE($3, "onboardingStatus"),
           "subscriptionPlan" = COALESCE($4, "subscriptionPlan"),
           "subscriptionStatus" = COALESCE($5, "subscriptionStatus"),
           notes = CASE WHEN $6::boolean THEN $7 ELSE notes END,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        id,
        nullableText(body.status, 40),
        nullableText(body.onboardingStatus, 40),
        nullableText(body.subscriptionPlan, 40),
        nullableText(body.subscriptionStatus, 40),
        Object.prototype.hasOwnProperty.call(body, 'notes'),
        nullableText(body.notes),
      )

      await writeBusinessAudit({
        actorUserId: session.userId,
        businessAccountId: id,
        action: 'business_account.updated',
        resourceType: 'BusinessAccount',
        resourceId: id,
        details: body,
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'create_support_case') {
      const title = text(body.title, 160)
      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Support case title is required.' },
          { status: 400 },
        )
      }

      const id = createBusinessId('support')
      const businessAccountId = nullableText(body.businessAccountId, 120)

      await db.$executeRawUnsafe(
        `INSERT INTO public."SupportCase"
          ("id", "businessAccountId", "title", "description", "category", "priority", "status", "requesterEmail", "assignedToUserId")
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)`,
        id,
        businessAccountId,
        title,
        nullableText(body.description, 4000),
        text(body.category, 40) || 'general',
        text(body.priority, 40) || 'normal',
        nullableText(body.requesterEmail, 180),
        session.userId,
      )

      await writeBusinessAudit({
        actorUserId: session.userId,
        businessAccountId,
        action: 'support_case.created',
        resourceType: 'SupportCase',
        resourceId: id,
        details: { title },
      })

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update_support_case') {
      const id = text(body.id, 120)
      const status = text(body.status, 40)
      if (!id || !status) {
        return NextResponse.json(
          { success: false, error: 'Support case ID and status are required.' },
          { status: 400 },
        )
      }

      await db.$executeRawUnsafe(
        `UPDATE public."SupportCase"
         SET status = $2,
           "resolvedAt" = CASE WHEN $2 IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE NULL END,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        id,
        status,
      )

      await writeBusinessAudit({
        actorUserId: session.userId,
        action: 'support_case.status_changed',
        resourceType: 'SupportCase',
        resourceId: id,
        details: { status },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'create_incident') {
      const title = text(body.title, 160)
      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Incident title is required.' },
          { status: 400 },
        )
      }

      const id = createBusinessId('incident')
      await db.$executeRawUnsafe(
        `INSERT INTO public."PlatformIncident"
          ("id", "title", "summary", "status", "severity", "createdByUserId")
         VALUES ($1, $2, $3, 'investigating', $4, $5)`,
        id,
        title,
        nullableText(body.summary, 4000),
        text(body.severity, 40) || 'minor',
        session.userId,
      )

      await writeBusinessAudit({
        actorUserId: session.userId,
        action: 'platform_incident.created',
        resourceType: 'PlatformIncident',
        resourceId: id,
        details: { title },
      })

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update_incident') {
      const id = text(body.id, 120)
      const status = text(body.status, 40)
      if (!id || !status) {
        return NextResponse.json(
          { success: false, error: 'Incident ID and status are required.' },
          { status: 400 },
        )
      }

      await db.$executeRawUnsafe(
        `UPDATE public."PlatformIncident"
         SET status = $2,
           "resolvedAt" = CASE WHEN $2 = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        id,
        status,
      )

      await writeBusinessAudit({
        actorUserId: session.userId,
        action: 'platform_incident.status_changed',
        resourceType: 'PlatformIncident',
        resourceId: id,
        details: { status },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'record_payment') {
      const businessAccountId = text(body.businessAccountId, 120)
      const amount = Number(body.amount)
      const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0

      if (!businessAccountId || amountCents < 0) {
        return NextResponse.json(
          { success: false, error: 'A valid business account and amount are required.' },
          { status: 400 },
        )
      }

      const id = createBusinessId('payment')
      const status = text(body.status, 40) || 'paid'

      await db.$executeRawUnsafe(
        `INSERT INTO public."PaymentRecord"
          ("id", "businessAccountId", "provider", "providerReference", "type", "amountCents", "currency", "status", "paidAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
        id,
        businessAccountId,
        text(body.provider, 40) || 'manual',
        nullableText(body.providerReference, 120),
        text(body.type, 40) || 'subscription',
        amountCents,
        text(body.currency, 8).toUpperCase() || 'USD',
        status,
      )

      await writeBusinessAudit({
        actorUserId: session.userId,
        businessAccountId,
        action: 'payment_record.created',
        resourceType: 'PaymentRecord',
        resourceId: id,
        details: { amountCents, status },
      })

      return NextResponse.json({ success: true, id })
    }

    return NextResponse.json(
      { success: false, error: 'Unknown admin action.' },
      { status: 400 },
    )
  } catch (error) {
    return adminError(error)
  }
}
