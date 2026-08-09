import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildBusinessAccountScopeSql,
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
  type WewedAdminContext,
} from '@/lib/wewed-admin'

export const dynamic = 'force-dynamic'

const BILLING_ACCOUNT_TYPES = ['couple', 'planning_company', 'venue', 'vendor', 'client'] as const
const BILLING_MODELS = ['free', 'subscription', 'contract'] as const
const LEGACY_PLANS = ['free', 'starter', 'professional', 'enterprise'] as const

type BillingAccountType = (typeof BILLING_ACCOUNT_TYPES)[number]
type BillingModel = (typeof BILLING_MODELS)[number]
type LegacyPlan = (typeof LEGACY_PLANS)[number]

class ProductivityRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message)
    this.name = 'ProductivityRequestError'
  }
}

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function stringArray(value: unknown, max = 50): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.map((item) => text(item, 120)).filter(Boolean)),
  ).slice(0, max)
}

function integerOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ProductivityRequestError('Pricing amounts must be non-negative whole cents.', 400)
  }
  return parsed
}

function hasPermission(context: WewedAdminContext, permission: string): boolean {
  return context.permissions.includes('*') || context.permissions.includes(permission)
}

function isSuperAdmin(context: WewedAdminContext): boolean {
  return context.adminRole === 'wewed_super_admin'
}

function isOperationsAdmin(context: WewedAdminContext): boolean {
  return isSuperAdmin(context) || context.adminRole === 'wewed_operations_admin'
}

function canReadBilling(context: WewedAdminContext): boolean {
  return hasPermission(context, 'admin.billing.read') || hasPermission(context, 'admin.billing.manage')
}

function canManageBilling(context: WewedAdminContext): boolean {
  return hasPermission(context, 'admin.billing.manage')
}

function canReadSupport(context: WewedAdminContext): boolean {
  return hasPermission(context, 'admin.support.read') || hasPermission(context, 'admin.support.manage')
}

function canSyncWork(context: WewedAdminContext): boolean {
  return (
    isOperationsAdmin(context) ||
    hasPermission(context, 'admin.billing.manage') ||
    hasPermission(context, 'admin.support.manage')
  )
}

function canReadQueueCategory(context: WewedAdminContext, category: string): boolean {
  if (isOperationsAdmin(context)) return true
  if (category === 'billing_attention') return canReadBilling(context)
  if (category === 'support') return canReadSupport(context)
  return false
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  if (error instanceof ProductivityRequestError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  console.error('[api/admin/productivity] Error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to complete the Admin productivity request.' },
    { status: 500 },
  )
}

function csvCell(value: unknown): string {
  const normalized = value === null || value === undefined ? '' : String(value)
  return `"${normalized.replaceAll('"', '""')}"`
}

function csvResponse(filename: string, headers: string[], rows: unknown[][]) {
  const body = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

async function validateDepartmentKeys(accountType: BillingAccountType, keys: string[]) {
  if (!keys.length) return
  const rows = await db.$queryRawUnsafe<Array<{ departmentKey: string }>>(
    `SELECT "departmentKey"
     FROM wewed_admin."ClientDepartmentDefinition"
     WHERE "accountType"=$1
       AND status='active'
       AND "departmentKey" = ANY($2::text[])`,
    accountType,
    keys,
  )
  const known = new Set(rows.map((row) => row.departmentKey))
  const unknown = keys.filter((key) => !known.has(key))
  if (unknown.length) {
    throw new ProductivityRequestError(
      `Unknown department keys for ${accountType}: ${unknown.join(', ')}.`,
      400,
    )
  }
}

type OfferInput = {
  accountType: BillingAccountType
  name: string
  description: string
  billingModel: BillingModel
  legacyPlan: LegacyPlan
  currency: string
  monthlyCents: number | null
  annualCents: number | null
  departmentKeys: string[]
  entitlements: string[]
  selfService: boolean
}

async function parseOfferInput(
  body: Record<string, unknown>,
  forcedAccountType?: string,
): Promise<OfferInput> {
  const accountType = text(forcedAccountType || body.accountType, 40) as BillingAccountType
  const name = text(body.name, 160)
  const description = text(body.description, 1000)
  const billingModel = text(body.billingModel, 40) as BillingModel
  const legacyPlan = text(body.legacyPlan, 40) as LegacyPlan
  const currency = text(body.currency || 'USD', 3).toUpperCase()
  const monthlyCents = integerOrNull(body.monthlyCents)
  const annualCents = integerOrNull(body.annualCents)
  const departmentKeys = stringArray(body.departmentKeys)
  const entitlements = stringArray(body.entitlements)
  const selfService = body.selfService === true

  if (!(BILLING_ACCOUNT_TYPES as readonly string[]).includes(accountType)) {
    throw new ProductivityRequestError('Invalid billing account type.', 400)
  }
  if (!name || !description) {
    throw new ProductivityRequestError('Offer name and description are required.', 400)
  }
  if (!(BILLING_MODELS as readonly string[]).includes(billingModel)) {
    throw new ProductivityRequestError('Invalid billing model.', 400)
  }
  if (!(LEGACY_PLANS as readonly string[]).includes(legacyPlan)) {
    throw new ProductivityRequestError('Invalid legacy plan mapping.', 400)
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ProductivityRequestError('Currency must be a three-letter ISO code.', 400)
  }
  if (billingModel === 'free') {
    if ((monthlyCents || 0) !== 0 || (annualCents || 0) !== 0 || selfService) {
      throw new ProductivityRequestError(
        'Free offers must have zero pricing and cannot be self-service checkout offers.',
        400,
      )
    }
  }
  if (billingModel === 'subscription' && monthlyCents === null && annualCents === null) {
    throw new ProductivityRequestError(
      'Subscription offers require a monthly or annual price.',
      400,
    )
  }
  if (billingModel === 'contract' && selfService) {
    throw new ProductivityRequestError('Contract offers cannot be self-service.', 400)
  }

  await validateDepartmentKeys(accountType, departmentKeys)
  return {
    accountType,
    name,
    description,
    billingModel,
    legacyPlan,
    currency,
    monthlyCents,
    annualCents,
    departmentKeys,
    entitlements,
    selfService,
  }
}

function validOfferCode(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,118}[a-z0-9]$/.test(value)
}

async function readOffers() {
  return db.$queryRawUnsafe<
    Array<{
      offerCode: string
      offerFamilyCode: string
      supersedesOfferCode: string | null
      accountType: string
      name: string
      description: string
      billingModel: string
      legacyPlan: string
      currency: string
      monthlyCents: number | null
      annualCents: number | null
      departmentKeys: unknown
      entitlements: unknown
      selfService: boolean
      status: string
      version: number
      assignmentCount: number
      createdAt: Date
      updatedAt: Date
    }>
  >(
    `SELECT offer."offerCode", offer."offerFamilyCode", offer."supersedesOfferCode",
            offer."accountType", offer.name, offer.description, offer."billingModel",
            offer."legacyPlan", offer.currency, offer."monthlyCents", offer."annualCents",
            offer."departmentKeys", offer.entitlements, offer."selfService", offer.status,
            offer.version, offer."createdAt", offer."updatedAt",
            (SELECT COUNT(*)::int
             FROM wewed_admin."BusinessAccountBillingProfile" profile
             WHERE profile."offerCode"=offer."offerCode"
               AND profile."accountType"=offer."accountType") AS "assignmentCount"
     FROM wewed_admin."BillingOffer" offer
     ORDER BY offer."accountType", offer."offerFamilyCode", offer.version DESC`,
  )
}

async function handleSearch(request: NextRequest, context: WewedAdminContext) {
  const q = text(request.nextUrl.searchParams.get('q'), 100).toLowerCase()
  const like = `%${q}%`
  const results: Array<Record<string, unknown>> = []

  const destinations = [
    { id: 'nav-home', kind: 'navigation', title: 'Admin Home', subtitle: 'Command Centre', panel: 'overview' },
    { id: 'nav-accounts', kind: 'navigation', title: 'Accounts', subtitle: 'Account registry and Account 360', panel: 'accounts' },
    { id: 'nav-people', kind: 'navigation', title: 'People & Organisation', subtitle: 'Wewed workforce', panel: 'people' },
    { id: 'nav-commercial', kind: 'navigation', title: 'Commercial', subtitle: 'Pricing and billing catalog', panel: 'commercial' },
    { id: 'nav-systems', kind: 'navigation', title: 'Client Systems', subtitle: 'Departments, systems and resources', href: '/admin/client-operations' },
    { id: 'nav-roles', kind: 'navigation', title: 'Roles & Permissions', subtitle: 'Platform administrator governance', href: '/admin/roles' },
    { id: 'nav-onboarding', kind: 'navigation', title: 'Onboarding', subtitle: 'Business onboarding management', href: '/admin/onboarding' },
  ]
  results.push(
    ...destinations.filter((item) =>
      !q || `${item.title} ${item.subtitle}`.toLowerCase().includes(q),
    ),
  )

  const accountScope = buildBusinessAccountScopeSql(context, 'ba', q ? 2 : 1)
  const accountFilter = q
    ? `(lower(ba.name) LIKE $1 OR lower(ba.slug) LIKE $1 OR lower(COALESCE(subtype.name,'')) LIKE $1)`
    : 'TRUE'
  const accountParameters = q ? [like, ...accountScope.values] : accountScope.values
  const accounts = await db.$queryRawUnsafe<
    Array<{ id: string; name: string; type: string; slug: string; subtypeName: string | null }>
  >(
    `SELECT ba.id, ba.name, ba.type, ba.slug, subtype.name AS "subtypeName"
     FROM wewed_admin."BusinessAccount" ba
     LEFT JOIN wewed_admin."BusinessAccountClassification" classification
       ON classification."businessAccountId"=ba.id
     LEFT JOIN wewed_admin."AccountSubtypeDefinition" subtype
       ON subtype."subtypeKey"=classification."subtypeKey"
      AND subtype."accountType"=classification."accountType"
     WHERE ${accountScope.clause}
       AND ${accountFilter}
     ORDER BY ba.name
     LIMIT 20`,
    ...accountParameters,
  )
  results.push(
    ...accounts.map((account) => ({
      id: `account:${account.id}`,
      kind: 'account',
      title: account.name,
      subtitle: `${account.type.replaceAll('_', ' ')}${account.subtypeName ? ` · ${account.subtypeName}` : ''}`,
      panel: 'accounts',
      search: account.name,
      businessAccountId: account.id,
    })),
  )

  const providerScope = buildBusinessAccountScopeSql(context, 'ba', q ? 2 : 1)
  const providerFilter = q
    ? `(lower(provider."displayName") LIKE $1 OR lower(provider.slug) LIKE $1)`
    : 'TRUE'
  const providerParameters = q ? [like, ...providerScope.values] : providerScope.values
  const providers = await db.$queryRawUnsafe<
    Array<{ id: string; displayName: string; businessAccountId: string; accountType: string }>
  >(
    `SELECT provider.id, provider."displayName", provider."businessAccountId", ba.type AS "accountType"
     FROM wewed_admin."ProviderProfile" provider
     JOIN wewed_admin."BusinessAccount" ba ON ba.id=provider."businessAccountId"
     WHERE ${providerScope.clause}
       AND ${providerFilter}
     ORDER BY provider."displayName"
     LIMIT 15`,
    ...providerParameters,
  )
  results.push(
    ...providers.map((provider) => ({
      id: `provider:${provider.id}`,
      kind: 'provider',
      title: provider.displayName,
      subtitle: `Provider · ${provider.accountType.replaceAll('_', ' ')}`,
      panel: 'accounts',
      search: provider.displayName,
      businessAccountId: provider.businessAccountId,
    })),
  )

  if (isSuperAdmin(context)) {
    const staff = await db.$queryRawUnsafe<
      Array<{ userId: string; email: string; name: string | null; jobTitle: string | null }>
    >(
      `SELECT member."userId", u.email, u.name, staff."jobTitle"
       FROM wewed_admin."BusinessAccountMember" member
       JOIN public."User" u ON u.id=member."userId"
       LEFT JOIN wewed_admin."InternalStaffProfile" staff ON staff."userId"=member."userId"
       WHERE member."businessAccountId"='wewed-platform'
         AND ($1='' OR lower(u.email) LIKE $2 OR lower(COALESCE(u.name,'')) LIKE $2 OR lower(COALESCE(staff."jobTitle",'')) LIKE $2)
       ORDER BY COALESCE(u.name,u.email)
       LIMIT 15`,
      q,
      like,
    )
    results.push(
      ...staff.map((person) => ({
        id: `staff:${person.userId}`,
        kind: 'staff',
        title: person.name || person.email,
        subtitle: person.jobTitle || person.email,
        panel: 'people',
        search: person.name || person.email,
      })),
    )
  }

  const savedViews = await db.$queryRawUnsafe<
    Array<{ id: string; name: string; screen: string }>
  >(
    `SELECT id,name,screen
     FROM wewed_admin."AdminSavedView"
     WHERE "administratorUserId"=$1
       AND ($2='' OR lower(name) LIKE $3)
     ORDER BY "isDefault" DESC,name
     LIMIT 15`,
    context.session.userId,
    q,
    like,
  )
  results.push(
    ...savedViews.map((view) => ({
      id: `view:${view.id}`,
      kind: 'saved_view',
      title: view.name,
      subtitle: `Saved ${view.screen} view`,
      panel: view.screen === 'queue' ? 'overview' : view.screen,
    })),
  )

  return NextResponse.json({ success: true, results: results.slice(0, 50) })
}

async function handleExport(request: NextRequest, context: WewedAdminContext) {
  const screen = text(request.nextUrl.searchParams.get('screen'), 30)
  let headers: string[] = []
  let rows: unknown[][] = []
  const filterSummary: Record<string, string> = { screen }

  if (screen === 'accounts') {
    const q = text(request.nextUrl.searchParams.get('q'), 100).toLowerCase()
    const accountType = text(request.nextUrl.searchParams.get('accountType'), 40)
    const subtype = text(request.nextUrl.searchParams.get('subtype'), 120)
    const scope = buildBusinessAccountScopeSql(context, 'ba', 4)
    const billingVisible = canReadBilling(context)
    const accountRows = await db.$queryRawUnsafe<
      Array<{
        name: string
        slug: string
        type: string
        status: string
        onboardingStatus: string
        subtypeName: string | null
        ownerEmail: string | null
        billingOfferName: string | null
        billingStatus: string | null
      }>
    >(
      `SELECT ba.name,ba.slug,ba.type,ba.status,ba."onboardingStatus",
              subtype_def.name AS "subtypeName",owner.email AS "ownerEmail",
              offer.name AS "billingOfferName",billing.status AS "billingStatus"
       FROM wewed_admin."BusinessAccount" ba
       LEFT JOIN public."User" owner ON owner.id=ba."ownerUserId"
       LEFT JOIN wewed_admin."BusinessAccountClassification" classification ON classification."businessAccountId"=ba.id
       LEFT JOIN wewed_admin."AccountSubtypeDefinition" subtype_def
         ON subtype_def."subtypeKey"=classification."subtypeKey" AND subtype_def."accountType"=classification."accountType"
       LEFT JOIN wewed_admin."BusinessAccountBillingProfile" billing ON billing."businessAccountId"=ba.id
       LEFT JOIN wewed_admin."BillingOffer" offer ON offer."offerCode"=billing."offerCode" AND offer."accountType"=billing."accountType"
       WHERE ${scope.clause}
         AND ($1='' OR lower(ba.name) LIKE '%'||$1||'%' OR lower(ba.slug) LIKE '%'||$1||'%' OR lower(COALESCE(owner.email,'')) LIKE '%'||$1||'%')
         AND ($2='' OR $2='all' OR ba.type=$2)
         AND ($3='' OR $3='all' OR classification."subtypeKey"=$3)
       ORDER BY ba.type,ba.name`,
      q,
      accountType,
      subtype,
      ...scope.values,
    )
    headers = ['Account', 'Slug', 'Type', 'Subtype', 'Lifecycle', 'Onboarding', 'Owner', 'Billing offer', 'Billing status']
    rows = accountRows.map((row) => [
      row.name,
      row.slug,
      row.type,
      row.subtypeName || '',
      row.status,
      row.onboardingStatus,
      row.ownerEmail || '',
      billingVisible ? row.billingOfferName || '' : 'Restricted',
      billingVisible ? row.billingStatus || '' : 'Restricted',
    ])
    filterSummary.q = q
    filterSummary.accountType = accountType
    filterSummary.subtype = subtype
  } else if (screen === 'queue') {
    const scope = buildBusinessAccountScopeSql(context, 'ba', 1)
    const queueRows = await db.$queryRawUnsafe<
      Array<{
        title: string
        accountName: string | null
        category: string
        priority: string
        status: string
        assignedToEmail: string | null
        departmentKey: string | null
        source: string
        createdAt: Date
      }>
    >(
      `SELECT item.title,ba.name AS "accountName",item.category,item.priority,item.status,
              assignee.email AS "assignedToEmail",item."departmentKey",item.source,item."createdAt"
       FROM wewed_admin."AdminWorkItem" item
       LEFT JOIN wewed_admin."BusinessAccount" ba ON ba.id=item."businessAccountId"
       LEFT JOIN public."User" assignee ON assignee.id=item."assignedToUserId"
       WHERE item.status IN ('open','in_progress','blocked')
         AND (item."businessAccountId" IS NULL OR (${scope.clause}))
       ORDER BY item.priority,item."createdAt"`,
      ...scope.values,
    )
    const visible = queueRows.filter((row) => canReadQueueCategory(context, row.category))
    headers = ['Title', 'Account', 'Category', 'Priority', 'Status', 'Assignee', 'Department', 'Source', 'Created']
    rows = visible.map((row) => [
      row.title,
      row.accountName || '',
      row.category,
      row.priority,
      row.status,
      row.assignedToEmail || '',
      row.departmentKey || '',
      row.source,
      row.createdAt.toISOString(),
    ])
  } else if (screen === 'people') {
    if (!isSuperAdmin(context)) {
      throw new WewedAdminAccessError('People exports are restricted to Super Admin.', 403)
    }
    const people = await db.$queryRawUnsafe<
      Array<{
        email: string
        name: string | null
        departmentName: string | null
        jobTitle: string | null
        employmentType: string | null
        employmentStatus: string | null
        platformRole: string | null
      }>
    >(
      `SELECT u.email,u.name,department.name AS "departmentName",staff."jobTitle",staff."employmentType",staff."employmentStatus",administrator.role AS "platformRole"
       FROM wewed_admin."BusinessAccountMember" member
       JOIN public."User" u ON u.id=member."userId"
       LEFT JOIN wewed_admin."InternalStaffProfile" staff ON staff."userId"=member."userId"
       LEFT JOIN wewed_admin."InternalDepartmentDefinition" department ON department."departmentKey"=staff."departmentKey"
       LEFT JOIN wewed_admin."PlatformAdministrator" administrator ON administrator."userId"=member."userId"
       WHERE member."businessAccountId"='wewed-platform'
       ORDER BY COALESCE(u.name,u.email)`,
    )
    headers = ['Name', 'Email', 'Department', 'Job title', 'Employment type', 'Employment status', 'Platform role']
    rows = people.map((row) => [
      row.name || '',
      row.email,
      row.departmentName || '',
      row.jobTitle || '',
      row.employmentType || '',
      row.employmentStatus || '',
      row.platformRole || '',
    ])
  } else if (screen === 'commercial') {
    if (!canReadBilling(context)) {
      throw new WewedAdminAccessError('Billing permission is required for commercial exports.', 403)
    }
    const offers = await readOffers()
    headers = ['Offer code', 'Family', 'Version', 'Account type', 'Name', 'Model', 'Currency', 'Monthly cents', 'Annual cents', 'Status', 'Assignments']
    rows = offers.map((offer) => [
      offer.offerCode,
      offer.offerFamilyCode,
      offer.version,
      offer.accountType,
      offer.name,
      offer.billingModel,
      offer.currency,
      offer.monthlyCents ?? '',
      offer.annualCents ?? '',
      offer.status,
      offer.assignmentCount,
    ])
  } else {
    throw new ProductivityRequestError('Unsupported export screen.', 400)
  }

  await writeBusinessAudit({
    actorUserId: context.session.userId,
    action: 'admin.export.generated',
    resourceType: 'AdminExport',
    resourceId: screen,
    details: { screen, filters: filterSummary, rowCount: rows.length },
  })
  return csvResponse(
    `wewed-admin-${screen}-${new Date().toISOString().slice(0, 10)}.csv`,
    headers,
    rows,
  )
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.accounts.read')
    const mode = text(request.nextUrl.searchParams.get('mode') || 'overview', 30)

    if (mode === 'search') return handleSearch(request, context)
    if (mode === 'export') return handleExport(request, context)
    if (mode === 'offers') {
      if (!canReadBilling(context)) {
        throw new WewedAdminAccessError(
          'Billing permission is required to read pricing governance.',
          403,
        )
      }
      const offers = await readOffers()
      return NextResponse.json({
        success: true,
        offers: offers.map((offer) => ({
          ...offer,
          createdAt: offer.createdAt.toISOString(),
          updatedAt: offer.updatedAt.toISOString(),
        })),
      })
    }
    if (mode !== 'overview') {
      throw new ProductivityRequestError('Unsupported productivity mode.', 400)
    }

    return NextResponse.json({
      success: true,
      admin: {
        role: context.adminRole,
        isSuperAdmin: isSuperAdmin(context),
        canSyncWorkItems: canSyncWork(context),
        canReadBilling: canReadBilling(context),
        canManageBilling: canManageBilling(context),
        canExportAccounts: true,
        canExportQueue:
          isOperationsAdmin(context) || canReadBilling(context) || canReadSupport(context),
        canExportPeople: isSuperAdmin(context),
        canExportCommercial: canReadBilling(context),
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.accounts.read')
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 80)

    if (action === 'sync_work_items') {
      if (!canSyncWork(context)) {
        throw new WewedAdminAccessError(
          'This administrator cannot synchronize operational work.',
          403,
        )
      }
      const rows = await db.$queryRawUnsafe<Array<{ result: unknown }>>(
        `SELECT wewed_admin.sync_admin_operational_work_items() AS result`,
      )
      await writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'admin.work_items.synchronized',
        resourceType: 'AdminWorkItem',
        details: { result: rows[0]?.result || null },
      })
      return NextResponse.json({ success: true, result: rows[0]?.result || {} })
    }

    if (action === 'create_offer') {
      if (!canManageBilling(context)) {
        throw new WewedAdminAccessError('Billing management permission is required.', 403)
      }
      const offerCode = text(body.offerCode, 120).toLowerCase()
      const reason = text(body.reason, 1000)
      if (!validOfferCode(offerCode) || reason.length < 5) {
        throw new ProductivityRequestError(
          'A valid offer code and reason of at least 5 characters are required.',
          400,
        )
      }
      const input = await parseOfferInput(body)
      const existing = await db.$queryRawUnsafe<Array<{ offerCode: string }>>(
        `SELECT "offerCode" FROM wewed_admin."BillingOffer" WHERE "offerCode"=$1 LIMIT 1`,
        offerCode,
      )
      if (existing[0]) throw new ProductivityRequestError('Offer code already exists.', 409)

      await db.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BillingOffer"
          ("offerCode","offerFamilyCode","accountType",name,description,"billingModel","legacyPlan",currency,
           "monthlyCents","annualCents","departmentKeys",entitlements,"selfService",status,version)
         VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,'active',1)`,
        offerCode,
        input.accountType,
        input.name,
        input.description,
        input.billingModel,
        input.legacyPlan,
        input.currency,
        input.monthlyCents,
        input.annualCents,
        JSON.stringify(input.departmentKeys),
        JSON.stringify(input.entitlements),
        input.selfService,
      )
      await writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'admin.billing.offer.created',
        resourceType: 'BillingOffer',
        resourceId: offerCode,
        details: { reason, accountType: input.accountType, version: 1 },
      })
      return NextResponse.json({ success: true, offerCode, version: 1 })
    }

    if (action === 'version_offer') {
      if (!canManageBilling(context)) {
        throw new WewedAdminAccessError('Billing management permission is required.', 403)
      }
      const sourceOfferCode = text(body.sourceOfferCode, 120)
      const reason = text(body.reason, 1000)
      if (!sourceOfferCode || reason.length < 5) {
        throw new ProductivityRequestError('Source offer and reason are required.', 400)
      }
      const sourceRows = await db.$queryRawUnsafe<
        Array<{
          offerCode: string
          offerFamilyCode: string
          accountType: string
          version: number
          status: string
        }>
      >(
        `SELECT "offerCode","offerFamilyCode","accountType",version,status
         FROM wewed_admin."BillingOffer" WHERE "offerCode"=$1 LIMIT 1`,
        sourceOfferCode,
      )
      const source = sourceRows[0]
      if (!source) throw new ProductivityRequestError('Source offer not found.', 404)
      if (source.status !== 'active') {
        throw new ProductivityRequestError('Only an active offer can be versioned.', 409)
      }
      const input = await parseOfferInput(body, source.accountType)
      const nextVersion = source.version + 1
      const nextOfferCode = `${source.offerFamilyCode}_v${nextVersion}`
      if (!validOfferCode(nextOfferCode)) {
        throw new ProductivityRequestError('Generated version offer code is invalid.', 409)
      }

      try {
        await db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `INSERT INTO wewed_admin."BillingOffer"
              ("offerCode","offerFamilyCode","supersedesOfferCode","accountType",name,description,"billingModel","legacyPlan",currency,
               "monthlyCents","annualCents","departmentKeys",entitlements,"selfService",status,version)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,'active',$15)`,
            nextOfferCode,
            source.offerFamilyCode,
            source.offerCode,
            source.accountType,
            input.name,
            input.description,
            input.billingModel,
            input.legacyPlan,
            input.currency,
            input.monthlyCents,
            input.annualCents,
            JSON.stringify(input.departmentKeys),
            JSON.stringify(input.entitlements),
            input.selfService,
            nextVersion,
          )
          await tx.$executeRawUnsafe(
            `UPDATE wewed_admin."BillingOffer"
             SET status='retired', "updatedAt"=CURRENT_TIMESTAMP
             WHERE "offerCode"=$1 AND status='active'`,
            source.offerCode,
          )
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (
          message.includes('BillingOffer_family_type_version_unique') ||
          message.includes('duplicate key')
        ) {
          throw new ProductivityRequestError('This offer version already exists.', 409)
        }
        throw error
      }

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'admin.billing.offer.versioned',
        resourceType: 'BillingOffer',
        resourceId: nextOfferCode,
        details: {
          reason,
          supersedesOfferCode: source.offerCode,
          family: source.offerFamilyCode,
          version: nextVersion,
        },
      })
      return NextResponse.json({ success: true, offerCode: nextOfferCode, version: nextVersion })
    }

    if (action === 'retire_offer') {
      if (!canManageBilling(context)) {
        throw new WewedAdminAccessError('Billing management permission is required.', 403)
      }
      const offerCode = text(body.offerCode, 120)
      const reason = text(body.reason, 1000)
      if (!offerCode || reason.length < 5) {
        throw new ProductivityRequestError('Offer and reason are required.', 400)
      }
      const rows = await db.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT status FROM wewed_admin."BillingOffer" WHERE "offerCode"=$1 LIMIT 1`,
        offerCode,
      )
      if (!rows[0]) throw new ProductivityRequestError('Offer not found.', 404)
      if (rows[0].status === 'retired') {
        throw new ProductivityRequestError('Offer is already retired.', 409)
      }
      await db.$executeRawUnsafe(
        `UPDATE wewed_admin."BillingOffer"
         SET status='retired',"updatedAt"=CURRENT_TIMESTAMP
         WHERE "offerCode"=$1`,
        offerCode,
      )
      await writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'admin.billing.offer.retired',
        resourceType: 'BillingOffer',
        resourceId: offerCode,
        details: { reason },
      })
      return NextResponse.json({ success: true })
    }

    throw new ProductivityRequestError('Unsupported Admin productivity action.', 400)
  } catch (error) {
    return errorResponse(error)
  }
}
