import { db } from '@/lib/db'
import { resolveVendorPlanningFields } from '@/lib/planner-legacy-metadata'
import {
  parseJson,
  type VendorPipelineStatus,
  type VendorPipelineValue,
} from '@/lib/planner-phase3'

interface VendorPlanningRecord {
  id: string
  description: string | null
  contact: string | null
  contractStatus: string
  paymentStatus: string
  planningRating: number | null
  notes: string | null
}

interface SyncVendorPipelineInput {
  weddingId: string
  actorId: string
  vendor: VendorPlanningRecord
  contractStatusChanged?: boolean
  paymentStatusChanged?: boolean
}

function statusFromContract(
  contractStatus: string,
  current?: VendorPipelineStatus,
  changed = false,
): VendorPipelineStatus {
  if (contractStatus === 'signed') return 'booked'
  if (contractStatus === 'declined') return 'rejected'
  if (contractStatus === 'negotiating') return 'negotiating'
  if (!changed && current) return current
  return 'lead'
}

/**
 * Keep the normalized Vendor record and planner pipeline projection aligned.
 * A transaction client can be supplied by worksheet imports so the Vendor and
 * ContentRevision writes commit or roll back together. Existing API callers
 * continue to use the default application database client.
 */
export async function syncVendorPipelineFromNormalizedVendor(
  input: SyncVendorPipelineInput,
  client: any = db,
): Promise<void> {
  const existing = await client.contentRevision.findFirst({
    where: {
      weddingId: input.weddingId,
      section: 'planner_vendor_pipeline',
      fieldKey: input.vendor.id,
    },
  })
  const current = existing
    ? parseJson<VendorPipelineValue | null>(existing.value, null)
    : null
  const planning = resolveVendorPlanningFields(input.vendor)
  const now = new Date().toISOString()

  let depositPaidAt = current?.depositPaidAt ?? null
  let balancePaidAt = current?.balancePaidAt ?? null
  if (input.paymentStatusChanged || !current) {
    if (planning.paymentStatus === 'paid') {
      depositPaidAt = depositPaidAt ?? now
      balancePaidAt = balancePaidAt ?? now
    } else if (planning.paymentStatus === 'deposit') {
      depositPaidAt = depositPaidAt ?? now
      balancePaidAt = null
    } else {
      depositPaidAt = null
      balancePaidAt = null
    }
  }

  const value: VendorPipelineValue = {
    version: 1,
    vendorId: input.vendor.id,
    contactName: planning.contact,
    email: current?.email ?? '',
    pipelineStatus: statusFromContract(
      planning.contractStatus,
      current?.pipelineStatus,
      input.contractStatusChanged || !current,
    ),
    quoteAmount: current?.quoteAmount ?? null,
    currency: current?.currency ?? 'USD',
    contractUrl: current?.contractUrl ?? '',
    depositAmount: current?.depositAmount ?? null,
    depositDueDate: current?.depositDueDate ?? null,
    depositPaidAt,
    balanceDueDate: current?.balanceDueDate ?? null,
    balancePaidAt,
    ownerUserId: current?.ownerUserId ?? null,
    ownerName: current?.ownerName ?? null,
    notes: planning.notes,
    updatedById: input.actorId,
    updatedAt: now,
  }

  if (existing) {
    await client.contentRevision.update({
      where: { id: existing.id },
      data: {
        value: JSON.stringify(value),
        status: 'active',
        authorId: input.actorId,
      },
    })
    return
  }

  await client.contentRevision.create({
    data: {
      section: 'planner_vendor_pipeline',
      fieldKey: input.vendor.id,
      value: JSON.stringify(value),
      status: 'active',
      weddingId: input.weddingId,
      authorId: input.actorId,
    },
  })
}
