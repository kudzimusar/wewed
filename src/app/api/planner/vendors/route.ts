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

    const meta: LegacyVendorMeta = {
      contact: body.contact?.trim() || undefined,
      contractStatus,
      paymentStatus,
      rating: rating ?? undefined,
      notes: body.notes?.trim() || undefined,
    }

    const created = await db.vendor.create({
      data: {
        name: body.name.trim(),
        category,
        description: encodeLegacyVendorDescription(body.description ?? null, meta),
        website: body.website?.trim() || null,
        phone: body.phone?.trim() || null,
        imageUrl: null,
        rating,
        featured: body.featured === true,
        weddingId: access.context.weddingId,
      },
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
