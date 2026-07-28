import { db } from '@/lib/db';
import { isAdmin } from '@/lib/admin-gate';
import { NextRequest, NextResponse } from 'next/server';

/* ============================================================
   /api/planner/timeline/[id]
   ------------------------------------------------------------
   • PATCH  → update any fields on a programme item
   • DELETE → remove a programme item
   ============================================================ */

interface TimelineMeta {
  d?: string; // duration
  l?: string; // location
  i?: string; // optional Lucide icon name
}

function encodeTimelineIcon(meta: TimelineMeta): string | null {
  const d = meta.d?.trim() || '';
  const l = meta.l?.trim() || '';
  const i = meta.i?.trim() || '';
  if (!d && !l && !i) return null;
  return JSON.stringify({
    ...(d ? { d } : {}),
    ...(l ? { l } : {}),
    ...(i ? { i } : {}),
  });
}

function decodeTimelineIcon(icon: string | null): {
  duration: string;
  location: string;
  icon?: string;
} {
  if (!icon) return { duration: '', location: '' };
  if (icon.startsWith('{')) {
    try {
      const blob = JSON.parse(icon) as TimelineMeta;
      return {
        duration: blob.d ?? '',
        location: blob.l ?? '',
        icon: blob.i,
      };
    } catch {
      /* fall through */
    }
  }
  return { duration: '', location: '', icon };
}

function formatProgrammeItem(p: {
  id: string;
  time: string;
  title: string;
  description: string | null;
  icon: string | null;
  order: number;
  weddingId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { duration, location, icon } = decodeTimelineIcon(p.icon);
  return {
    id: p.id,
    time: p.time,
    event: p.title,
    title: p.title,
    description: p.description,
    notes: p.description ?? '',
    duration,
    location,
    icon,
    order: p.order,
    weddingId: p.weddingId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

interface PatchTimelinePayload {
  time?: string;
  event?: string;
  title?: string;
  notes?: string | null;
  description?: string | null;
  duration?: string | null;
  location?: string | null;
  icon?: string | null;
  order?: number;
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
        { success: false, error: 'Item id is required' },
        { status: 400 }
      );
    }

    const existing = await db.programmeItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Timeline item not found' },
        { status: 404 }
      );
    }

    const body = (await request.json()) as PatchTimelinePayload;
    const updates: Record<string, unknown> = {};

    if (body.time !== undefined) {
      const t = (body.time ?? '').trim();
      if (!t) {
        return NextResponse.json(
          { success: false, error: 'Time cannot be empty' },
          { status: 400 }
        );
      }
      updates.time = t;
    }

    if (body.event !== undefined || body.title !== undefined) {
      const t = (body.event ?? body.title ?? '').trim();
      if (!t) {
        return NextResponse.json(
          { success: false, error: 'Event title cannot be empty' },
          { status: 400 }
        );
      }
      updates.title = t;
    }

    if (body.notes !== undefined || body.description !== undefined) {
      const val = body.notes ?? body.description;
      updates.description = val?.trim() || null;
    }

    if (body.order !== undefined) {
      if (typeof body.order !== 'number' || !Number.isFinite(body.order)) {
        return NextResponse.json(
          { success: false, error: 'order must be a number' },
          { status: 400 }
        );
      }
      updates.order = body.order;
    }

    // Duration + location are packed into the icon field as JSON.
    // We re-encode from existing decoded values + any patched ones,
    // so partial updates don't blow away untouched fields.
    if (body.duration !== undefined || body.location !== undefined || body.icon !== undefined) {
      const decoded = decodeTimelineIcon(existing.icon);
      const next: TimelineMeta = {
        d: body.duration !== undefined ? (body.duration ?? '') : decoded.duration,
        l: body.location !== undefined ? (body.location ?? '') : decoded.location,
        i: body.icon !== undefined ? (body.icon ?? undefined) : decoded.icon,
      };
      updates.icon = encodeTimelineIcon(next);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    const updated = await db.programmeItem.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      success: true,
      data: formatProgrammeItem(updated),
    });
  } catch (error) {
    console.error('[PLANNER TIMELINE PATCH] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update timeline item' },
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
        { success: false, error: 'Item id is required' },
        { status: 400 }
      );
    }

    const existing = await db.programmeItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Timeline item not found' },
        { status: 404 }
      );
    }

    await db.programmeItem.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (error) {
    console.error('[PLANNER TIMELINE DELETE] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete timeline item' },
      { status: 500 }
    );
  }
}
