import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  decodeLegacyVendorDescription,
  encodeLegacyVendorDescription,
  type LegacyVendorMeta,
} from '@/lib/planner-legacy-metadata'
import { requireWeddingPermission } from '@/lib/wedding-access'

const CATEGORIES = [
  'venue',
  'caterer',
  'photographer',
  'videographer',
  'florist',
  'dj',
  'decor',
  'transport',
  'stationery',
  'other',
] as const
const CONTRACT_STATUSES = ['signed', 'pending', 'negotiating', 'declined'] as const
const PAYMENT_STATUSES = ['paid', 'deposit', 'unpaid'] as const

function formatVendor(v: {
  id: string
  name: string
  category: string
  description: string | null
  website: string | null
  phone: string | null
  imageUrl: string | null
  rating: number | null
  featured: boolean
  weddingId: string
  createdAt: Date
  updatedAt: Date
}) {
  const { meta, humanDescription } = decodeLegacyVendorDescription(v.description)
  return {
    id: v.id,
    name: v.name,
    category: v.category,
    description: humanDescription,
    website: v.website,
    phone: v.phone,
    imageUrl: v.imageUrl,
    rating: v.rating,
    featured: v.featured,
    contact: meta.contact ?? '',
    contractStatus: meta.contractStatus ?? 'pending',
    paymentStatus: meta.paymentStatus ?? 'unpaid',
    metaRating: typeof meta.rating === 'number' ? meta.rating : null,
    notes: meta.notes ?? '',
    weddingId: v.weddingId,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }
}

interface PatchVendorPayload {
  name?: string
  category?: string
  description?: string | null
  website?: string | null
  phone?: string | null
  contact?: string | null
  contractStatus?: string
  paymentStatus?: string
  rating?: number | null
  notes?: string | null
  featured?: boolean
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const existing = await db.vendor.findFirst({
      where: { id, weddingId: access.context.weddingId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Vendor not found' },
        { status: 404 },
      )
    }

    const body = (await request.json()) as PatchVendorPayload
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json(
          { success: false, error: 'Name cannot be empty' },
          { status: 400 },
        )
      }
      updates.name = body.name.trim()
    }
    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category as (typeof CATEGORIES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid category. Allowed: ${CATEGORIES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.category = body.category
    }
    if (body.website !== undefined) updates.website = body.website?.trim() || null
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null
    if (body.featured !== undefined) updates.featured = body.featured === true
    if (body.rating !== undefined) {
      if (body.rating === null) updates.rating = null
      else if (typeof body.rating === 'number' && body.rating >= 0 && body.rating <= 5) {
        updates.rating = body.rating
      } else {
        return NextResponse.json(
          { success: false, error: 'Rating must be between 0 and 5' },
          { status: 400 },
        )
      }
    }

    const decoded = decodeLegacyVendorDescription(existing.description)
    const mergedMeta: LegacyVendorMeta = { ...decoded.meta }
    let humanDescription = decoded.humanDescription
    if (body.description !== undefined) {
      humanDescription = body.description?.trim() || null
    }
    if (body.contact !== undefined) mergedMeta.contact = body.contact?.trim() || undefined
    if (body.contractStatus !== undefined) {
      if (!CONTRACT_STATUSES.includes(body.contractStatus as (typeof CONTRACT_STATUSES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid contractStatus. Allowed: ${CONTRACT_STATUSES.join(', ')}` },
          { status: 400 },
        )
      }
      mergedMeta.contractStatus = body.contractStatus
    }
    if (body.paymentStatus !== undefined) {
      if (!PAYMENT_STATUSES.includes(body.paymentStatus as (typeof PAYMENT_STATUSES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid paymentStatus. Allowed: ${PAYMENT_STATUSES.join(', ')}` },
          { status: 400 },
        )
      }
      mergedMeta.paymentStatus = body.paymentStatus
    }
    if (body.notes !== undefined) mergedMeta.notes = body.notes?.trim() || undefined
    if (typeof body.rating === 'number') mergedMeta.rating = body.rating
    if (body.rating === null) delete mergedMeta.rating

    updates.description = encodeLegacyVendorDescription(humanDescription, mergedMeta)

    const updated = await db.vendor.update({
      where: { id: existing.id },
      data: updates,
    })
    return NextResponse.json({ success: true, data: formatVendor(updated) })
  } catch (error) {
    console.error('[PLANNER VENDOR PATCH] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update vendor' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const existing = await db.vendor.findFirst({
      where: { id, weddingId: access.context.weddingId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Vendor not found' },
        { status: 404 },
      )
    }

    await db.vendor.delete({ where: { id: existing.id } })
    return NextResponse.json({ success: true, data: { id, deleted: true } })
  } catch (error) {
    console.error('[PLANNER VENDOR DELETE] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete vendor' },
      { status: 500 },
    )
  }
}
