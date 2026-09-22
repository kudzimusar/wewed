import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertWewedAdminPermission,
  createBusinessId,
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
} from '@/lib/wewed-admin'
import {
  canTransitionAccount,
  hasWewedAdminPermission,
  isAccountLifecycleStatus,
  isWewedAdminRole,
  normalizeAccountLifecycleStatus,
  permissionForAccountTransition,
} from '@/lib/wewed-admin-policy'
import { loadAdminOverview } from '@/lib/admin/overview'

export const dynamic = 'force-dynamic'

type AdminAction =
  | 'create_account'
  | 'update_account'
  | 'transition_account'
  | 'update_admin_role'
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

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
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
    const context = await requireWewedAdmin(request, 'admin.overview.read')
    const canReadBilling = hasWewedAdminPermission(context.permissions, 'admin.billing.read')
    const canReadSupport = hasWewedAdminPermission(context.permissions, 'admin.support.read')
    const canReadIncidents = hasWewedAdminPermission(context.permissions, 'admin.incidents.read')
    const canReadAudit = hasWewedAdminPermission(context.permissions, 'admin.audit.read')
    const canReadMembers = hasWewedAdminPermission(context.permissions, 'admin.members.read')

    const {
      summary,
      analytics,
      accounts,
      accountMembers: memberRows,
      accountLinks: linkRows,
      adminUsers: adminUserRows,
      supportCases: supportRows,
      incidents: incidentRows,
      payments: paymentRows,
      auditLog: auditRows,
    } = await loadAdminOverview({ canReadBilling, canReadSupport, canReadIncidents, canReadAudit, canReadMembers })

    return NextResponse.json({
      success: true,
      admin: {
        email: context.session.email,
        role: context.adminRole,
        permissions: context.permissions,
        membershipId: context.membershipId,
      },
      summary,
      analytics,
      accounts,
      accountMembers: memberRows,
      accountLinks: linkRows,
      adminUsers: adminUserRows,
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
    const context = await requireWewedAdmin(request, 'admin.overview.read')
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 50) as AdminAction

    if (action === 'create_account') {
      assertWewedAdminPermission(context, 'admin.accounts.create')
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
          ("id", "name", "slug", "type", "status", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "notes", "metadata")
         VALUES ($1, $2, $3, $4, 'pending_review', 'not_started', $5, $6, $7, $8::jsonb)`,
        id,
        name,
        slug,
        type,
        plan,
        plan === 'free' ? 'free' : 'trialing',
        nullableText(body.notes),
        JSON.stringify({ createdByAdminUserId: context.session.userId }),
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId: id,
        action: 'business_account.created_for_review',
        resourceType: 'BusinessAccount',
        resourceId: id,
        details: { name, type, plan, status: 'pending_review' },
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

      const hasOperationalFields = ['onboardingStatus', 'notes'].some((key) =>
        Object.prototype.hasOwnProperty.call(body, key),
      )
      const hasBillingFields = ['subscriptionPlan', 'subscriptionStatus'].some((key) =>
        Object.prototype.hasOwnProperty.call(body, key),
      )

      if (!hasOperationalFields && !hasBillingFields) {
        return NextResponse.json(
          { success: false, error: 'No supported account fields were supplied.' },
          { status: 400 },
        )
      }

      if (hasOperationalFields) assertWewedAdminPermission(context, 'admin.accounts.approve')
      if (hasBillingFields) assertWewedAdminPermission(context, 'admin.billing.manage')

      await db.$executeRawUnsafe(
        `UPDATE public."BusinessAccount"
         SET
           "onboardingStatus" = COALESCE($2, "onboardingStatus"),
           "subscriptionPlan" = COALESCE($3, "subscriptionPlan"),
           "subscriptionStatus" = COALESCE($4, "subscriptionStatus"),
           notes = CASE WHEN $5::boolean THEN $6 ELSE notes END,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1 AND type <> 'wewed_internal'`,
        id,
        nullableText(body.onboardingStatus, 40),
        nullableText(body.subscriptionPlan, 40),
        nullableText(body.subscriptionStatus, 40),
        Object.prototype.hasOwnProperty.call(body, 'notes'),
        nullableText(body.notes),
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId: id,
        action: 'business_account.details_updated',
        resourceType: 'BusinessAccount',
        resourceId: id,
        details: {
          onboardingStatus: body.onboardingStatus,
          subscriptionPlan: body.subscriptionPlan,
          subscriptionStatus: body.subscriptionStatus,
          notesChanged: Object.prototype.hasOwnProperty.call(body, 'notes'),
        },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'transition_account') {
      const id = text(body.id, 120)
      const nextStatus = text(body.status, 40)
      const reason = text(body.reason, 500)
      const note = nullableText(body.note, 2000)

      if (!id || !isAccountLifecycleStatus(nextStatus) || !reason) {
        return NextResponse.json(
          { success: false, error: 'Account ID, valid next status and reason are required.' },
          { status: 400 },
        )
      }

      const rows = await db.$queryRawUnsafe<
        Array<{
          id: string
          name: string
          type: string
          status: string
          metadata: Record<string, unknown>
        }>
      >(
        `SELECT id, name, type, status, metadata FROM public."BusinessAccount" WHERE id = $1 LIMIT 1`,
        id,
      )
      const account = rows[0]

      if (!account) {
        return NextResponse.json({ success: false, error: 'Business account was not found.' }, { status: 404 })
      }
      if (account.type === 'wewed_internal') {
        return NextResponse.json({ success: false, error: 'The Wewed parent account cannot use the client lifecycle.' }, { status: 409 })
      }

      const currentStatus = normalizeAccountLifecycleStatus(account.status)
      if (!canTransitionAccount(currentStatus, nextStatus)) {
        return NextResponse.json(
          { success: false, error: `Transition from ${currentStatus} to ${nextStatus} is not allowed.` },
          { status: 409 },
        )
      }

      assertWewedAdminPermission(
        context,
        permissionForAccountTransition(currentStatus, nextStatus),
      )

      const metadata = objectValue(account.metadata)
      const nextMetadata = {
        ...metadata,
        lifecycle: {
          previousStatus: currentStatus,
          status: nextStatus,
          reason,
          note,
          changedAt: new Date().toISOString(),
          changedByUserId: context.session.userId,
        },
      }

      await db.$transaction([
        db.$executeRawUnsafe(
          `UPDATE public."BusinessAccount"
           SET status = $2,
             metadata = $3::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          id,
          nextStatus,
          JSON.stringify(nextMetadata),
        ),
        db.$executeRawUnsafe(
          `INSERT INTO public."BusinessAuditLog"
            ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
           VALUES ($1, $2, $3, 'business_account.lifecycle_transitioned', 'BusinessAccount', $3, $4::jsonb)`,
          createBusinessId('audit'),
          context.session.userId,
          id,
          JSON.stringify({ accountName: account.name, previousStatus: currentStatus, status: nextStatus, reason, note }),
        ),
      ])

      return NextResponse.json({ success: true })
    }

    if (action === 'update_admin_role') {
      assertWewedAdminPermission(context, 'admin.members.manage')
      const membershipId = text(body.membershipId, 120)
      const role = text(body.role, 80)
      const status = text(body.status, 40) || 'active'

      if (!membershipId || !isWewedAdminRole(role) || !['active', 'suspended', 'revoked'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'A valid administrator membership, role and status are required.' },
          { status: 400 },
        )
      }
      if (role === 'wewed_super_admin' && context.adminRole !== 'wewed_super_admin') {
        throw new WewedAdminAccessError('Only a Super Admin may assign the Super Admin role.', 403)
      }

      const targets = await db.$queryRawUnsafe<
        Array<{ membershipId: string; userId: string; email: string; role: string; status: string }>
      >(
        `SELECT bam.id AS "membershipId", bam."userId", u.email, bam.role, bam.status
         FROM public."BusinessAccountMember" bam
         JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
         JOIN public."User" u ON u.id = bam."userId"
         WHERE bam.id = $1 AND ba.type = 'wewed_internal'
         LIMIT 1`,
        membershipId,
      )
      const target = targets[0]
      if (!target) {
        return NextResponse.json({ success: false, error: 'Administrator membership was not found.' }, { status: 404 })
      }

      if (
        target.role === 'wewed_super_admin' &&
        (role !== 'wewed_super_admin' || status !== 'active')
      ) {
        const counts = await db.$queryRawUnsafe<Array<{ count: number }>>(`
          SELECT COUNT(*)::int AS count
          FROM public."BusinessAccountMember" bam
          JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
          WHERE ba.type = 'wewed_internal'
            AND bam.role = 'wewed_super_admin'
            AND bam.status = 'active'
        `)
        if ((counts[0]?.count ?? 0) <= 1) {
          return NextResponse.json(
            { success: false, error: 'At least one active Wewed Super Admin must remain.' },
            { status: 409 },
          )
        }
      }

      await db.$transaction([
        db.$executeRawUnsafe(
          `UPDATE public."BusinessAccountMember"
           SET role = $2, status = $3, permissions = '[]'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          membershipId,
          role,
          status,
        ),
        db.$executeRawUnsafe(
          `INSERT INTO public."BusinessAuditLog"
            ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
           VALUES ($1, $2, $3, 'admin_membership.updated', 'BusinessAccountMember', $4, $5::jsonb)`,
          createBusinessId('audit'),
          context.session.userId,
          context.businessAccountId,
          membershipId,
          JSON.stringify({ targetEmail: target.email, previousRole: target.role, role, previousStatus: target.status, status }),
        ),
      ])

      return NextResponse.json({ success: true })
    }

    if (action === 'create_support_case') {
      assertWewedAdminPermission(context, 'admin.support.manage')
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
        context.session.userId,
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId,
        action: 'support_case.created',
        resourceType: 'SupportCase',
        resourceId: id,
        details: { title },
      })

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update_support_case') {
      assertWewedAdminPermission(context, 'admin.support.manage')
      const id = text(body.id, 120)
      const status = text(body.status, 40)
      if (!id || !['open', 'in_progress', 'waiting', 'resolved', 'closed'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Support case ID and valid status are required.' },
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
        actorUserId: context.session.userId,
        action: 'support_case.status_changed',
        resourceType: 'SupportCase',
        resourceId: id,
        details: { status },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'create_incident') {
      assertWewedAdminPermission(context, 'admin.incidents.manage')
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
        context.session.userId,
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'platform_incident.created',
        resourceType: 'PlatformIncident',
        resourceId: id,
        details: { title },
      })

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update_incident') {
      assertWewedAdminPermission(context, 'admin.incidents.manage')
      const id = text(body.id, 120)
      const status = text(body.status, 40)
      if (!id || !['investigating', 'identified', 'monitoring', 'resolved'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Incident ID and valid status are required.' },
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
        actorUserId: context.session.userId,
        action: 'platform_incident.status_changed',
        resourceType: 'PlatformIncident',
        resourceId: id,
        details: { status },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'record_payment') {
      assertWewedAdminPermission(context, 'admin.billing.manage')
      const businessAccountId = text(body.businessAccountId, 120)
      const amount = Number(body.amount)
      const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : -1

      if (!businessAccountId || amountCents < 0) {
        return NextResponse.json(
          { success: false, error: 'A valid business account and amount are required.' },
          { status: 400 },
        )
      }

      const id = createBusinessId('payment')
      const status = text(body.status, 40) || 'paid'
      if (!['paid', 'pending', 'due', 'failed', 'refunded'].includes(status)) {
        return NextResponse.json({ success: false, error: 'Payment status is invalid.' }, { status: 400 })
      }

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
        actorUserId: context.session.userId,
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
