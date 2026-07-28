import { db } from '@/lib/db';
import { isAdmin } from '@/lib/admin-gate';
import { NextRequest, NextResponse } from 'next/server';

/* ============================================================
   /api/planner/timeline
   ------------------------------------------------------------
   The couple's day-of timeline (managed inside the Wedding
   Planner dashboard). Backed by the existing ProgrammeItem
   Prisma model — the SAME model the seed route populates for
   the public Programme section.

   Field mapping (TimelineBlock ↔ ProgrammeItem):
   • time        → time           (string, e.g. "14:00")
   • event       → title          (string)
   • notes       → description    (string?, human notes)
   • duration    → packed in icon (JSON blob {d, l, i?})
   • location    → packed in icon (JSON blob {d, l, i?})
   • id          → id
   • (sort)      → order          (Int, ascending)

   The icon field serves dual purpose:
   • Seeded items: a Lucide icon name (e.g. "GlassWater")
   • Planner-edited items: a JSON blob `{"d":"30 min","l":"Hall","i":"Heart"}`
   decodeTimelineMeta() handles both formats transparently.

   • GET  → list all programme items for flagship wedding (ordered)
   • POST → create a new programme item (admin-gated)
   ============================================================ */

const FLAGSHIP_SLUG = 'charity-and-kudzie';

// ─── Meta encoding helpers ──────────────────────────────────
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
  // JSON blob form (planner-edited)
  if (icon.startsWith('{')) {
    try {
      const blob = JSON.parse(icon) as TimelineMeta;
      return {
        duration: blob.d ?? '',
        location: blob.l ?? '',
        icon: blob.i,
      };
    } catch {
      /* fall through to legacy */
    }
  }
  // Legacy form: treat as Lucide icon name only
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
    title: p.title, // alias for clients expecting `title`
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

async function getFlagshipWeddingId(): Promise<string | null> {
  const w = await db.wedding.findFirst({
    where: { slug: FLAGSHIP_SLUG },
    select: { id: true },
  });
  return w?.id ?? null;
}

// ─── GET /api/planner/timeline ──────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Flagship wedding not found. Seed the database first.' },
        { status: 404 }
      );
    }

    const items = await db.programmeItem.findMany({
      where: { weddingId },
      orderBy: [{ order: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      count: items.length,
      data: items.map(formatProgrammeItem),
    });
  } catch (error) {
    console.error('[PLANNER TIMELINE GET] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}

// ─── POST /api/planner/timeline ─────────────────────────────
interface CreateTimelinePayload {
  time?: string;
  event?: string; // alias of title
  title?: string;
  notes?: string;
  description?: string;
  duration?: string;
  location?: string;
  icon?: string;
  order?: number;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized — admin access required' },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as CreateTimelinePayload;

    const title = (body.event ?? body.title ?? '').trim();
    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Event title is required' },
        { status: 400 }
      );
    }

    const time = (body.time ?? '').trim();
    if (!time) {
      return NextResponse.json(
        { success: false, error: 'Time is required (e.g. "14:00")' },
        { status: 400 }
      );
    }

    const notes = (body.notes ?? body.description ?? '').trim() || null;

    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Flagship wedding not found. Seed the database first.' },
        { status: 404 }
      );
    }

    // Determine the next order value (append to the end)
    let order: number;
    if (typeof body.order === 'number' && Number.isFinite(body.order)) {
      order = body.order;
    } else {
      const last = await db.programmeItem.findFirst({
        where: { weddingId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = (last?.order ?? 0) + 1;
    }

    const iconBlob = encodeTimelineIcon({
      d: body.duration ?? '',
      l: body.location ?? '',
      i: body.icon,
    });

    const created = await db.programmeItem.create({
      data: {
        time,
        title,
        description: notes,
        icon: iconBlob,
        order,
        weddingId,
      },
    });

    return NextResponse.json(
      { success: true, data: formatProgrammeItem(created) },
      { status: 201 }
    );
  } catch (error) {
    console.error('[PLANNER TIMELINE POST] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create timeline item' },
      { status: 500 }
    );
  }
}
