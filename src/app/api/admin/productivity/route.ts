import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireWewedAdmin,
  WewedAdminAccessError,
  type WewedAdminContext,
} from '@/lib/wewed-admin'
import {
  GET as readProductivityCore,
  POST as mutateProductivityCore,
} from '@/lib/admin-productivity-route-core'

export const dynamic = 'force-dynamic'

type SearchResult = {
  id: string
  kind: string
  title: string
  subtitle: string
  panel?: string
  href?: string
  search?: string
  businessAccountId?: string
  [key: string]: unknown
}

type ProductivityPayload = {
  success?: boolean
  admin?: Record<string, unknown>
  results?: SearchResult[]
  [key: string]: unknown
}

function isGlobalSuperAdmin(context: WewedAdminContext): boolean {
  return context.adminRole === 'wewed_super_admin' && context.accountScope.global
}

function adminAccessError(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }
  console.error('[api/admin/productivity] Wrapper error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to complete the Admin productivity request.' },
    { status: 500 },
  )
}

async function enrichProviderSearchTargets(response: Response) {
  if (!response.ok) return response
  const payload = (await response.json()) as ProductivityPayload
  if (!payload.success || !Array.isArray(payload.results)) {
    return NextResponse.json(payload, { status: response.status })
  }

  const providerResults = payload.results.filter(
    (result) => result.kind === 'provider' && typeof result.businessAccountId === 'string',
  )
  const accountIds = Array.from(
    new Set(providerResults.map((result) => result.businessAccountId as string)),
  )

  if (!accountIds.length) {
    return NextResponse.json(payload, { status: response.status })
  }

  const accounts = await db.$queryRawUnsafe<
    Array<{ id: string; name: string; slug: string; type: string }>
  >(
    `SELECT id,name,slug,type
     FROM wewed_admin."BusinessAccount"
     WHERE id = ANY($1::text[])`,
    accountIds,
  )
  const byId = new Map(accounts.map((account) => [account.id, account]))

  const results = payload.results.flatMap((result) => {
    if (result.kind !== 'provider' || !result.businessAccountId) return [result]
    const account = byId.get(result.businessAccountId)
    if (!account) return []

    // The core provider query is already server-scope filtered. Resolve its returned
    // BusinessAccount ID to the canonical unique account slug and feed that exact
    // account target into the existing Accounts command path. This avoids relying on
    // ProviderProfile.displayName, which is not necessarily searchable in the account registry.
    return [
      {
        ...result,
        id: `account:${account.id}:provider-result`,
        kind: 'account',
        title: account.name,
        subtitle: `Provider ${result.title} · ${account.type.replaceAll('_', ' ')}`,
        search: account.slug,
        businessAccountId: account.id,
      },
    ]
  })

  return NextResponse.json({ ...payload, results }, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get('mode') || 'overview'

    if (mode === 'overview') {
      const context = await requireWewedAdmin(request, 'admin.accounts.read')
      const response = await readProductivityCore(request)
      if (!response.ok) return response

      const payload = (await response.json()) as ProductivityPayload
      return NextResponse.json(
        {
          ...payload,
          admin: payload.admin
            ? {
                ...payload.admin,
                // Synchronization currently materializes every canonical work category.
                // Only a globally scoped Super Admin is authorized to mutate that global set.
                canSyncWorkItems: isGlobalSuperAdmin(context),
              }
            : payload.admin,
        },
        { status: response.status },
      )
    }

    if (mode === 'search') {
      return enrichProviderSearchTargets(await readProductivityCore(request))
    }

    return readProductivityCore(request)
  } catch (error) {
    return adminAccessError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.clone().json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action.trim() : ''

    if (action === 'sync_work_items') {
      const context = await requireWewedAdmin(request, 'admin.accounts.read')
      if (!isGlobalSuperAdmin(context)) {
        throw new WewedAdminAccessError(
          'Operational work synchronization is restricted to a globally scoped Super Admin.',
          403,
        )
      }
      return mutateProductivityCore(request)
    }

    if (action === 'create_offer') {
      const offerCode =
        typeof body.offerCode === 'string' ? body.offerCode.trim().toLowerCase() : ''

      // Serialize competing creates for the same commercial key in PostgreSQL. The
      // existing core existence check then deterministically returns 409 to the loser
      // instead of allowing a primary-key race to surface as a generic 500.
      return db.$transaction(
        async (tx) => {
          await tx.$queryRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
            offerCode,
          )
          return mutateProductivityCore(request)
        },
        { maxWait: 5_000, timeout: 15_000 },
      )
    }

    return mutateProductivityCore(request)
  } catch (error) {
    return adminAccessError(error)
  }
}
