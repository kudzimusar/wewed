import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   /api/planner/guests/[id]?kind=guest|table
   ------------------------------------------------------------
   • PATCH  → update guest (name, email, side, table assignment)
              OR update a table (name, capacity, position)
              (use ?kind=table for table mutations)
   • DELETE → remove a guest OR a table (use ?kind=table)
              Deleting a table unassigns its guests first.
   ============================================================ */

const ADMIN_COOKIE_KEY = "wewed_admin_auth";
const NONCE_PATTERN = /^[a-f0-9]{16}$/;

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

interface PatchGuestPayload {
  name?: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  roleDetail?: string | null;
  side?: string;
  seatingTableId?: string | null;
}

interface PatchTablePayload {
  name?: string;
  capacity?: number;
  position?: string | null;
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") === "table" ? "table" : "guest";

    // ── Table branch ──
    if (kind === "table") {
      const existing = await db.seatingTable.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: "Table not found" },
          { status: 404 }
        );
      }
      const body = (await request.json()) as PatchTablePayload;
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || body.name.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: "Table name cannot be empty" },
            { status: 400 }
          );
        }
        updates.name = body.name.trim();
      }
      if (body.capacity !== undefined) {
        if (typeof body.capacity !== "number" || Number.isNaN(body.capacity) || body.capacity <= 0) {
          return NextResponse.json(
            { success: false, error: "capacity must be a positive number" },
            { status: 400 }
          );
        }
        updates.capacity = Math.min(50, Math.floor(body.capacity));
      }
      if (body.position !== undefined) {
        updates.position = body.position || null;
      }
      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { success: false, error: "No updates provided" },
          { status: 400 }
        );
      }
      const updated = await db.seatingTable.update({
        where: { id },
        data: updates,
      });
      return NextResponse.json({ success: true, data: formatTable(updated) });
    }

    // ── Guest branch ──
    const existing = await db.guest.findUnique({
      where: { id },
      include: { rsvp: true, seatingTable: { select: { id: true, name: true, capacity: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Guest not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as PatchGuestPayload;
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
    if (body.role !== undefined) {
      if (!(GUEST_ROLES as readonly string[]).includes(body.role)) {
        return NextResponse.json(
          { success: false, error: `Invalid role. Allowed: ${GUEST_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.role = body.role;
    }
    if (body.roleDetail !== undefined) updates.roleDetail = body.roleDetail?.trim() || null;
    if (body.side !== undefined) {
      if (!(GUEST_SIDES as readonly string[]).includes(body.side)) {
        return NextResponse.json(
          { success: false, error: `Invalid side. Allowed: ${GUEST_SIDES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.side = body.side;
    }
    if (body.seatingTableId !== undefined) {
      if (body.seatingTableId === null || body.seatingTableId === "") {
        updates.seatingTableId = null;
      } else {
        const t = await db.seatingTable.findUnique({
          where: { id: body.seatingTableId },
          select: { id: true, weddingId: true },
        });
        if (!t || t.weddingId !== existing.weddingId) {
          return NextResponse.json(
            { success: false, error: "Invalid seatingTableId" },
            { status: 400 }
          );
        }
        updates.seatingTableId = body.seatingTableId;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No updates provided" },
        { status: 400 }
      );
    }

    const updated = await db.guest.update({
      where: { id },
      data: updates,
      include: {
        rsvp: true,
        seatingTable: { select: { id: true, name: true, capacity: true } },
      },
    });

    return NextResponse.json({ success: true, data: formatGuest(updated) });
  } catch (error) {
    console.error("[PLANNER GUEST PATCH] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update" },
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
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") === "table" ? "table" : "guest";

    if (kind === "table") {
      const existing = await db.seatingTable.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: "Table not found" },
          { status: 404 }
        );
      }
      // Unassign guests first (defensive — set seatingTableId to null)
      await db.guest.updateMany({
        where: { seatingTableId: id },
        data: { seatingTableId: null },
      });
      await db.seatingTable.delete({ where: { id } });
      return NextResponse.json({
        success: true,
        data: { id, deleted: true, kind: "table" },
      });
    }

    const existing = await db.guest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Guest not found" },
        { status: 404 }
      );
    }
    // Cascade: delete RSVP first if exists (FK constraint)
    await db.rSVP.deleteMany({ where: { guestId: id } });
    await db.guest.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { id, deleted: true, kind: "guest" },
    });
  } catch (error) {
    console.error("[PLANNER GUEST DELETE] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete" },
      { status: 500 }
    );
  }
}
