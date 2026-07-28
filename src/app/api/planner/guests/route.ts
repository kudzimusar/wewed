import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   /api/planner/guests
   ------------------------------------------------------------
   The couple's master guest list — separate from the public
   RSVP flow. Each guest is a Guest row; their RSVP (if any)
   is included so the couple can see who has responded.

   Seating tables are managed here too (since they're tightly
   coupled with guest assignment). Use ?kind=table on mutations
   or include a `kind: 'table'` field on POST.

   • GET  → { guests: [...], tables: [...] }
            Each guest includes: rsvp status, meal, +1, kids,
            seatingTableId, seatingTableName
   • POST → create a guest (or a table when kind=table)

   Same soft admin gate pattern as /api/planner/tasks.
   ============================================================ */

const ADMIN_COOKIE_KEY = "wewed_admin_auth";
const NONCE_PATTERN = /^[a-f0-9]{16}$/;
const FLAGSHIP_SLUG = "charity-and-kudzie";

const GUEST_ROLES = ["guest", "bridal_party", "family", "officiant", "vip"] as const;
const GUEST_SIDES = ["bride", "groom", "family", "neutral"] as const;

function isAdmin(request: NextRequest): boolean {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_KEY)?.value;
    if (cookie && NONCE_PATTERN.test(cookie)) return true;
  } catch {
    /* ignore */
  }
  if (process.env.NODE_ENV !== "production") {
    const url = new URL(request.url);
    if (url.searchParams.get("admin") === "1") return true;
  }
  return false;
}

async function getFlagshipWeddingId(): Promise<string | null> {
  const w = await db.wedding.findFirst({
    where: { slug: FLAGSHIP_SLUG },
    select: { id: true },
  });
  return w?.id ?? null;
}

function formatGuest(g: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  roleDetail: string | null;
  side: string | null;
  tableNumber: number | null;
  seatingTableId: string | null;
  seatingTable: { id: string; name: string; capacity: number } | null;
  weddingId: string;
  createdAt: Date;
  updatedAt: Date;
  rsvp: {
    id: string;
    token: string;
    attending: boolean | null;
    mealChoice: string | null;
    plusOne: boolean;
    plusOneName: string | null;
    plusOneMeal: string | null;
    kidsAttending: boolean;
    kidsCount: number;
    dietaryNotes: string | null;
    message: string | null;
    checkedIn: boolean;
    checkedInAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}) {
  return {
    id: g.id,
    name: g.name,
    email: g.email,
    phone: g.phone,
    role: g.role,
    roleDetail: g.roleDetail,
    side: g.side,
    tableNumber: g.tableNumber,
    seatingTableId: g.seatingTableId,
    seatingTableName: g.seatingTable?.name ?? null,
    weddingId: g.weddingId,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    rsvp: g.rsvp
      ? {
          id: g.rsvp.id,
          token: g.rsvp.token,
          attending: g.rsvp.attending,
          mealChoice: g.rsvp.mealChoice,
          plusOne: g.rsvp.plusOne,
          plusOneName: g.rsvp.plusOneName,
          plusOneMeal: g.rsvp.plusOneMeal,
          kidsAttending: g.rsvp.kidsAttending,
          kidsCount: g.rsvp.kidsCount,
          dietaryNotes: g.rsvp.dietaryNotes,
          message: g.rsvp.message,
          checkedIn: g.rsvp.checkedIn,
          checkedInAt: g.rsvp.checkedInAt ? g.rsvp.checkedInAt.toISOString() : null,
          createdAt: g.rsvp.createdAt.toISOString(),
          updatedAt: g.rsvp.updatedAt.toISOString(),
        }
      : null,
  };
}

function formatTable(t: {
  id: string;
  name: string;
  capacity: number;
  position: string | null;
  weddingId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    name: t.name,
    capacity: t.capacity,
    position: t.position,
    weddingId: t.weddingId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// ─── GET /api/planner/guests ────────────────────────────────
export async function GET() {
  try {
    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: "Flagship wedding not found. Seed the database first." },
        { status: 404 }
      );
    }

    const [guests, tables] = await Promise.all([
      db.guest.findMany({
        where: { weddingId },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
        orderBy: [{ side: "asc" }, { name: "asc" }],
      }),
      db.seatingTable.findMany({
        where: { weddingId },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      count: guests.length,
      data: guests.map(formatGuest),
      tables: tables.map(formatTable),
    });
  } catch (error) {
    console.error("[PLANNER GUESTS GET] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch guests" },
      { status: 500 }
    );
  }
}

// ─── POST /api/planner/guests ───────────────────────────────
interface CreateGuestPayload {
  kind?: "guest" | "table";
  // Guest fields
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  roleDetail?: string;
  side?: string;
  seatingTableId?: string;
  // Table fields
  tableName?: string;
  capacity?: number;
  position?: string;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as CreateGuestPayload;
    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: "Flagship wedding not found. Seed the database first." },
        { status: 404 }
      );
    }

    // ── Branch: create a table ──
    if (body.kind === "table") {
      if (!body.tableName || typeof body.tableName !== "string" || body.tableName.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Table name is required" },
          { status: 400 }
        );
      }
      const capacity =
        typeof body.capacity === "number" && !Number.isNaN(body.capacity) && body.capacity > 0
          ? Math.min(50, Math.floor(body.capacity))
          : 8;

      const table = await db.seatingTable.create({
        data: {
          name: body.tableName.trim(),
          capacity,
          position: body.position ?? null,
          weddingId,
        },
      });

      return NextResponse.json(
        { success: true, data: formatTable(table) },
        { status: 201 }
      );
    }

    // ── Branch: create a guest ──
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    const role = (GUEST_ROLES as readonly string[]).includes(body.role ?? "")
      ? body.role!
      : "guest";

    const side = (GUEST_SIDES as readonly string[]).includes(body.side ?? "")
      ? body.side!
      : "neutral";

    // Validate seatingTableId if provided
    if (body.seatingTableId) {
      const t = await db.seatingTable.findUnique({
        where: { id: body.seatingTableId },
        select: { id: true, weddingId: true },
      });
      if (!t || t.weddingId !== weddingId) {
        return NextResponse.json(
          { success: false, error: "Invalid seatingTableId" },
          { status: 400 }
        );
      }
    }

    const guest = await db.guest.create({
      data: {
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        role,
        roleDetail: body.roleDetail?.trim() || null,
        side,
        seatingTableId: body.seatingTableId || null,
        weddingId,
      },
      include: {
        rsvp: true,
        seatingTable: { select: { id: true, name: true, capacity: true } },
      },
    });

    return NextResponse.json(
      { success: true, data: formatGuest(guest) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[PLANNER GUESTS POST] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create guest" },
      { status: 500 }
    );
  }
}
