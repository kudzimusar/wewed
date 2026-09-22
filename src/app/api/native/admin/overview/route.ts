import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantAdminPermission, noStoreJson } from '@/lib/native-domain-context'

/**
 * Master plan Phase 8 §13 — a lightweight Admin system overview (real counts only). Admin is
 * system-scoped, never wedding-scoped (§13: "Do not create a fake Admin wedding"), so this returns
 * no `weddingId` and derives nothing from one. The PWA's full `/api/admin/overview` (932 lines:
 * billing, support cases, incidents) is UNSUPPORTED in this phase and tracked as remaining work —
 * this route only surfaces the pending-onboarding queue size, reusing the exact WHERE clause
 * `/api/admin/onboarding` GET already uses for that same queue.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request, { workspaceKind: 'admin' })
  if (!result.ok) return result.response
  const { grant } = result.context

  const permission = requireGrantAdminPermission(grant, 'admin.overview.read')
  if (!permission.ok) return permission.response

  const [pendingOnboardingCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*) AS count
       FROM public."BusinessAccount" ba
      WHERE ba."sourceType" = 'public_registration'
        AND ba.status = 'active'
        AND ba."onboardingStatus" <> 'complete'`,
  )

  return noStoreJson({
    success: true,
    scopeKind: 'system',
    platformRoles: grant.platformRoles,
    counts: {
      pendingOnboarding: Number(pendingOnboardingCount?.count ?? 0),
    },
  })
}
