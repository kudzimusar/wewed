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

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error

  try {
    const vendors = await db.vendor.findMany({
      where: { weddingId: access.context.weddingId },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      success: true,
      count: vendors.length,
      data: vendors.map(formatVendor),
    })
  } catch (error) {
    console.error('[PLANNER VENDORS GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendors' },
      { status: 500 },
    )
  }
}

interface CreateVendorPayload {
  name?: string
  category?: string
  description?: string
  website?: string
  phone?: string
  email?: string
  contact?: string
  contractStatus?: string
  paymentStatus?: string
  rating?: number
  notes?: string
  featured?: boolean
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as CreateVendorPayload
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vendor name is required' },
        { status: 400 },
      )
    }

    let email: string | null
    try {
      email = normalizedEmail(body.email)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Enter a valid vendor email address', field: 'email' },
        { status: 400 },
      )
    }

    const category = CATEGORIES.includes(body.category as (typeof CATEGORIES)[number])
      ? body.category!
      : 'other'
    const contractStatus = CONTRACT_STATUSES.includes(
      body.contractStatus as (typeof CONTRACT_STATUSES)[number],
    )
      ? body.contractStatus!
      : 'pending'
    const paymentStatus = PAYMENT_STATUSES.includes(
      body.paymentStatus as (typeof PAYMENT_STATUSES)[number],
    )
      ? body.paymentStatus!
      : 'unpaid'
    const rating =
      typeof body.rating === 'number' && body.rating >= 0 && body.rating <= 5
        ? body.rating
        : null

    const created = await db.vendor.create({
      data: {
        name: body.name.trim(),
        category,
        description: body.description?.trim() || null,
        website: body.website?.trim() || null,
        phone: body.phone?.trim() || null,
        email,
        imageUrl: null,
        rating,
        featured: body.featured === true,
        contact: body.contact?.trim() || null,
        contractStatus,
        paymentStatus,
        planningRating: rating,
        notes: body.notes?.trim() || null,
        weddingId: access.context.weddingId,
      },
    })

    await syncVendorPipelineFromNormalizedVendor({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      vendor: created,
      contractStatusChanged: true,
      paymentStatusChanged: true,
    })

    return NextResponse.json(
      { success: true, data: formatVendor(created) },
      { status: 201 },
    )
  } catch (error) {
    console.error('[PLANNER VENDORS POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create vendor' },
      { status: 500 },
    )
  }
}
