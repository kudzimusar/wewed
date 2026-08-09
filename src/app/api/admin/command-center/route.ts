import { NextRequest, NextResponse } from 'next/server'
import {
  GET as readCommandCentreCore,
  POST as mutateCommandCentreCore,
} from '@/lib/admin-command-center-route-core'

export const dynamic = 'force-dynamic'

type QueueItem = {
  resourceType: string
  resourceId: string
  category: string
  businessAccountId: string | null
  projected?: boolean
}

type AccountSummary = {
  id: string
  type: string
  onboardingStatus: string
  ownerEmail: string | null
}

type CommandCentrePayload = {
  success?: boolean
  accounts?: AccountSummary[]
  queue?: QueueItem[]
  metrics?: Record<string, number>
  [key: string]: unknown
}

function workKey(item: Pick<QueueItem, 'resourceType' | 'resourceId' | 'category'>) {
  return `${item.resourceType}:${item.resourceId}:${item.category}`
}

export async function GET(request: NextRequest) {
  const response = await readCommandCentreCore(request)
  if (!response.ok) return response

  const payload = (await response.json()) as CommandCentrePayload
  if (!payload.success || !Array.isArray(payload.queue) || !Array.isArray(payload.accounts)) {
    return NextResponse.json(payload, { status: response.status })
  }

  const accountsById = new Map(payload.accounts.map((account) => [account.id, account]))
  const persistedKeys = new Set(
    payload.queue
      .filter((item) => item.projected === false)
      .map((item) => workKey(item)),
  )

  const queue = payload.queue.filter((item) => {
    if (item.projected !== true) return true
    if (persistedKeys.has(workKey(item))) return false

    // Imported/unclaimed marketplace listings intentionally have no owner and
    // are not active onboarding work. Keep the projection consistent with the
    // durable work-item synchronization boundary.
    if (item.category === 'onboarding' && item.businessAccountId) {
      const account = accountsById.get(item.businessAccountId)
      return Boolean(account?.ownerEmail)
    }
    return true
  })

  const onboardingAttention = payload.accounts.filter(
    (account) =>
      account.type !== 'wewed_internal' &&
      Boolean(account.ownerEmail) &&
      account.onboardingStatus !== 'complete',
  ).length

  return NextResponse.json({
    ...payload,
    queue,
    metrics: {
      ...(payload.metrics || {}),
      onboardingAttention,
    },
  })
}

export async function POST(request: NextRequest) {
  return mutateCommandCentreCore(request)
}
