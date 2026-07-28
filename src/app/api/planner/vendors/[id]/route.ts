import { db } from '@/lib/db';
import { isAdmin } from '@/lib/admin-gate';
import { NextRequest, NextResponse } from 'next/server';

/* ============================================================
   /api/planner/vendors/[id]
   ------------------------------------------------------------
   • PATCH  → update any fields on a vendor
   • DELETE → remove a vendor
   ============================================================ */

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

const CONTRACT_STATUSES = ['signed', 'pending', 'negotiating', 'declined'] as const;
const PAYMENT_STATUSES = ['paid', 'deposit', 'unpaid'] as const;

const META_PREFIX = '__wewed_meta__:';

interface VendorMeta {
  contact?: string;
  contractStatus?: string;
  paymentStatus?: string;
  rating?: number;
  notes?: string;
}

function encodeMeta(description: string | null, meta: VendorMeta): string | null {
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

interface PatchVendorPayload {
  name?: string;
  category?: string;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  contact?: string | null;
  contractStatus?: string;
  paymentStatus?: string;
  rating?: number | null;
  notes?: string | null;
  featured?: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — admin access required' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Vendor id is required' },
        { status: 400 }
      );
    }

    const existing = await db.vendor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Vendor not found' },
        { status: 404 }
      );
    }

    const body = (await request.json()) as PatchVendorPayload;
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Name cannot be empty' },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }
    if (body.category !== undefined) {
      if (!(CATEGORIES as readonly string[]).includes(body.category)) {
        return NextResponse.json(
          { success: false, error: `Invalid category. Allowed: ${CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.category = body.category;
    }
    if (body.website !== undefined) {
      updates.website = body.website?.trim() || null;
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone?.trim() || null;
    }
    if (body.featured !== undefined) {
      updates.featured = body.featured === true;
    }
    if (body.rating !== undefined) {
      if (body.rating === null) {
        updates.rating = null;
      } else if (typeof body.rating === 'number' && body.rating >= 0 && body.rating <= 5) {
        updates.rating = body.rating;
      } else {
        return NextResponse.json(
          { success: false, error: 'Rating must be a number between 0 and 5' },
          { status: 400 }
        );
      }
    }

    // Merge planning meta (contact / contractStatus / paymentStatus / notes / rating)
    // with the human description. We always re-encode from the existing meta + any
    // patched meta fields, so partial updates don't blow away untouched fields.
    const existingDecoded = decodeMeta(existing.description);
    const mergedMeta: VendorMeta = { ...existingDecoded.meta };

    if (body.description !== undefined) {
      // Treat `description` as the human description (NOT the meta blob)
      existingDecoded.humanDescription = body.description?.trim() || null;
    }
    if (body.contact !== undefined) {
      mergedMeta.contact = body.contact?.trim() || undefined;
    }
    if (body.contractStatus !== undefined) {
      if (!(CONTRACT_STATUSES as readonly string[]).includes(body.contractStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid contractStatus. Allowed: ${CONTRACT_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      mergedMeta.contractStatus = body.contractStatus;
    }
    if (body.paymentStatus !== undefined) {
      if (!(PAYMENT_STATUSES as readonly string[]).includes(body.paymentStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid paymentStatus. Allowed: ${PAYMENT_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      mergedMeta.paymentStatus = body.paymentStatus;
    }
    if (body.notes !== undefined) {
      mergedMeta.notes = body.notes?.trim() || undefined;
    }
    if (typeof body.rating === 'number') {
      mergedMeta.rating = body.rating;
    }

    updates.description = encodeMeta(existingDecoded.humanDescription, mergedMeta);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    const updated = await db.vendor.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      success: true,
      data: formatVendor(updated),
    });
  } catch (error) {
    console.error('[PLANNER VENDOR PATCH] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update vendor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — admin access required' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Vendor id is required' },
        { status: 400 }
      );
    }

    const existing = await db.vendor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Vendor not found' },
        { status: 404 }
      );
    }

    await db.vendor.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (error) {
    console.error('[PLANNER VENDOR DELETE] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete vendor' },
      { status: 500 }
    );
  }
}
