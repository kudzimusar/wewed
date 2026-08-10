import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveVendorPlanningFields } from '@/lib/planner-legacy-metadata'
import { syncVendorPipelineFromNormalizedVendor } from '@/lib/planner-vendor-pipeline-sync'
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

function normalizedEmail(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error('INVALID_VENDOR_EMAIL')
  const email = value.trim().toLowerCase()
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('INVALID_VENDOR_EMAIL')
  }
  return email
}

function formatVendor(v: {
  id: string
  name: string
  category: string
  description: string | null
  website: string | null
  phone: string | null
  email: string | null
  imageUrl: string | null
  rating: number | null
  featured: boolean
  contact: string | null
  contractStatus: string
  paymentStatus: string
  planningRating: number | null
  notes: string | null
  weddingId: string
  createdAt: Date
  updatedAt: Date
}) {
  const planning = resolveVendorPlanningFields(v)
  return {
    id: v.id,
    name: v.name,
    category: v.category,
    description: planning.description,
    website: v.website,
    phone: v.phone,
    email: v.email,
    imageUrl: v.imageUrl,
    rating: v.rating,
    featured: v.featured,
    contact: planning.contact,
    contractStatus: planning.contractStatus,
    paymentStatus: planning.paymentStatus,
    metaRating: planning.planningRating,
    notes: planning.notes,
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
  email?: string | null
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
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.website !== undefined) updates.website = body.website?.trim() || null
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null
    if (body.email !== undefined) {
      try {
        updates.email = normalizedEmail(body.email)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Enter a valid vendor email address', field: 'email' },
          { status: 400 },
        )
      }
    }
    if (body.featured !== undefined) updates.featured = body.featured === true
    if (body.contact !== undefined) updates.contact = body.contact?.trim() || null
    if (body.contractStatus !== undefined) {
      if (!CONTRACT_STATUSES.includes(body.contractStatus as (typeof CONTRACT_STATUSES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid contractStatus. Allowed: ${CONTRACT_STATUSES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.contractStatus = body.contractStatus
    }
    if (body.paymentStatus !== undefined) {
      if (!PAYMENT_STATUSES.includes(body.paymentStatus as (typeof PAYMENT_STATUSES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid paymentStatus. Allowed: ${PAYMENT_STATUSES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.paymentStatus = body.paymentStatus
    }
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null
    if (body.rating !== undefined) {
      if (body.rating === null) {
        updates.rating = null
        updates.planningRating = null
      } else if (typeof body.rating === 'number' && body.rating >= 0 && body.rating <= 5) {
        updates.rating = body.rating
        updates.planningRating = body.rating
      } else {
        return NextResponse.json(
          { success: false, error: 'Rating must be between 0 and 5' },
          { status: 400 },
        )
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 },
      )
    }

    const updated = await db.vendor.update({
      where: { id: existing.id },
      data: updates,
    })
    await syncVendorPipelineFromNormalizedVendor({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      vendor: updated,
      contractStatusChanged: body.contractStatus !== undefined,
      paymentStatusChanged: body.paymentStatus !== undefined,
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

    await db.$transaction([
      db.contentRevision.deleteMany({
        where: {
          weddingId: access.context.weddingId,
          section: 'planner_vendor_pipeline',
          fieldKey: existing.id,
        },
      }),
      db.vendor.delete({ where: { id: existing.id } }),
    ])
    return NextResponse.json({ success: true, data: { id, deleted: true } })
  } catch (error) {
    console.error('[PLANNER VENDOR DELETE] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete vendor' },
      { status: 500 },
    )
  }
}
