import { db } from '@/lib/db';
import { isAdmin } from '@/lib/admin-gate';
import { NextRequest, NextResponse } from 'next/server';

/* ============================================================
   /api/planner/vendors
   ------------------------------------------------------------
   The couple's private vendor contacts (managed inside the
   Wedding Planner dashboard). This is SEPARATE from the public
   Vendor marketplace rows returned by /api/wedding — those are
   read-only curated entries. Anything created here is a private
   tracking record (contract status, payment status, notes).

   Uses the existing Vendor Prisma model. The extra planning
   fields (contractStatus, paymentStatus) are stored as a JSON
   blob inside `description` under a sentinel prefix so we
   don't need a schema migration. The client reads them back
   transparently via the helpers in wedding-planner.tsx.

   • GET  → list all vendors for the flagship wedding
   • POST → create a new vendor (admin-gated)
   ============================================================ */

const FLAGSHIP_SLUG = 'charity-and-kudzie';

// Allowed vendor categories (matches wedding-planner.tsx options)
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
] as const;
type Category = (typeof CATEGORIES)[number];

const CONTRACT_STATUSES = ['signed', 'pending', 'negotiating', 'declined'] as const;
const PAYMENT_STATUSES = ['paid', 'deposit', 'unpaid'] as const;

/** Sentinel prefix marking description as a planning-meta JSON blob. */
const META_PREFIX = '__wewed_meta__:';

interface VendorMeta {
  contact?: string;
  contractStatus?: string;
  paymentStatus?: string;
  rating?: number;
  notes?: string;
}

function encodeMeta(description: string | null, meta: VendorMeta): string | null {
  // Preserve any "human" description alongside the meta blob.
  const human = description?.trim() || '';
  const blob = JSON.stringify(meta);
  return `${META_PREFIX}${blob}${human ? `|||${human}` : ''}`;
}

function decodeMeta(description: string | null): {
  meta: VendorMeta;
  humanDescription: string | null;
} {
  if (!description) return { meta: {}, humanDescription: null };
  if (!description.startsWith(META_PREFIX)) {
    return { meta: {}, humanDescription: description };
  }
  const rest = description.slice(META_PREFIX.length);
  const [blob, ...humanParts] = rest.split('|||');
  try {
    const meta = JSON.parse(blob) as VendorMeta;
    return {
      meta,
      humanDescription: humanParts.length ? humanParts.join('|||') : null,
    };
  } catch {
    return { meta: {}, humanDescription: description };
  }
}

function formatVendor(v: {
  id: string;
  name: string;
  category: string;
  description: string | null;
  website: string | null;
  phone: string | null;
  imageUrl: string | null;
  rating: number | null;
  featured: boolean;
  weddingId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { meta, humanDescription } = decodeMeta(v.description);
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
    // Planning-only metadata (decoded from the description blob)
    contact: meta.contact ?? '',
    contractStatus: meta.contractStatus ?? 'pending',
    paymentStatus: meta.paymentStatus ?? 'unpaid',
    metaRating: typeof meta.rating === 'number' ? meta.rating : null,
    notes: meta.notes ?? '',
    weddingId: v.weddingId,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

async function getFlagshipWeddingId(): Promise<string | null> {
  const w = await db.wedding.findFirst({
    where: { slug: FLAGSHIP_SLUG },
    select: { id: true },
  });
  return w?.id ?? null;
}

// ─── GET /api/planner/vendors ───────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Flagship wedding not found. Seed the database first.' },
        { status: 404 }
      );
    }

    const vendors = await db.vendor.findMany({
      where: { weddingId },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      count: vendors.length,
      data: vendors.map(formatVendor),
    });
  } catch (error) {
    console.error('[PLANNER VENDORS GET] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

// ─── POST /api/planner/vendors ──────────────────────────────
interface CreateVendorPayload {
  name?: string;
  category?: string;
  description?: string;
  website?: string;
  phone?: string;
  contact?: string;
  contractStatus?: string;
  paymentStatus?: string;
  rating?: number;
  notes?: string;
  featured?: boolean;
}

export async function POST(request: NextRequest) {
  // Admin gate
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — admin access required' },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as CreateVendorPayload;

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Vendor name is required' },
        { status: 400 }
      );
    }

    const category: Category = (CATEGORIES as readonly string[]).includes(body.category ?? '')
      ? (body.category as Category)
      : 'other';

    const contractStatus = (CONTRACT_STATUSES as readonly string[]).includes(
      body.contractStatus ?? ''
    )
      ? body.contractStatus
      : 'pending';

    const paymentStatus = (PAYMENT_STATUSES as readonly string[]).includes(
      body.paymentStatus ?? ''
    )
      ? body.paymentStatus
      : 'unpaid';

    const rating =
      typeof body.rating === 'number' && body.rating >= 0 && body.rating <= 5
        ? body.rating
        : null;

    const meta: VendorMeta = {
      contact: body.contact?.trim() || undefined,
      contractStatus,
      paymentStatus,
      rating: typeof body.rating === 'number' ? body.rating : undefined,
      notes: body.notes?.trim() || undefined,
    };

    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Flagship wedding not found. Seed the database first.' },
        { status: 404 }
      );
    }

    const created = await db.vendor.create({
      data: {
        name: body.name.trim(),
        category,
        description: encodeMeta(body.description ?? null, meta),
        website: body.website?.trim() || null,
        phone: body.phone?.trim() || null,
        imageUrl: null,
        rating,
        featured: body.featured === true,
        weddingId,
      },
    });

    return NextResponse.json(
      { success: true, data: formatVendor(created) },
      { status: 201 }
    );
  } catch (error) {
    console.error('[PLANNER VENDORS POST] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
}
