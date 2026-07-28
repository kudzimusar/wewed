import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   /api/planner/budget/[id]
   ------------------------------------------------------------
   • PATCH  → update budget item (actualCost, paidAmount, etc.)
   • DELETE → remove a budget item
   ============================================================ */

const ADMIN_COOKIE_KEY = "wewed_admin_auth";
const NONCE_PATTERN = /^[a-f0-9]{16}$/;

const BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "attire",
  "roora",
  "decor",
  "photo_video",
  "music",
  "transport",
  "stationery",
  "miscellaneous",
] as const;

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

interface PatchBudgetPayload {
  category?: string;
  description?: string;
  estimatedCost?: number;
  actualCost?: number | null;
  paidAmount?: number;
  currency?: string;
  vendorId?: string | null;
  dueDate?: string | null;
}

function formatItem(item: {
  id: string;
  category: string;
  description: string;
  estimatedCost: number;
  actualCost: number | null;
  paidAmount: number;
  currency: string;
  vendorId: string | null;
  dueDate: Date | null;
  weddingId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    category: item.category,
    description: item.description,
    estimatedCost: item.estimatedCost,
    actualCost: item.actualCost,
    paidAmount: item.paidAmount,
    currency: item.currency,
    vendorId: item.vendorId,
    dueDate: item.dueDate ? item.dueDate.toISOString() : null,
    weddingId: item.weddingId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
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
        { success: false, error: "Budget item id is required" },
        { status: 400 }
      );
    }

    const existing = await db.budgetItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Budget item not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as PatchBudgetPayload;
    const updates: Record<string, unknown> = {};

    if (body.category !== undefined) {
      if (!(BUDGET_CATEGORIES as readonly string[]).includes(body.category)) {
        return NextResponse.json(
          { success: false, error: `Invalid category. Allowed: ${BUDGET_CATEGORIES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.category = body.category;
    }
    if (body.description !== undefined) {
      if (typeof body.description !== "string" || body.description.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Description cannot be empty" },
          { status: 400 }
        );
      }
      updates.description = body.description.trim();
    }
    if (body.estimatedCost !== undefined) {
      if (typeof body.estimatedCost !== "number" || Number.isNaN(body.estimatedCost)) {
        return NextResponse.json(
          { success: false, error: "estimatedCost must be a number" },
          { status: 400 }
        );
      }
      updates.estimatedCost = Math.max(0, body.estimatedCost);
    }
    if (body.actualCost !== undefined) {
      if (body.actualCost === null) {
        updates.actualCost = null;
      } else if (typeof body.actualCost !== "number" || Number.isNaN(body.actualCost)) {
        return NextResponse.json(
          { success: false, error: "actualCost must be a number or null" },
          { status: 400 }
        );
      } else {
        updates.actualCost = Math.max(0, body.actualCost);
      }
    }
    if (body.paidAmount !== undefined) {
      if (typeof body.paidAmount !== "number" || Number.isNaN(body.paidAmount)) {
        return NextResponse.json(
          { success: false, error: "paidAmount must be a number" },
          { status: 400 }
        );
      }
      updates.paidAmount = Math.max(0, body.paidAmount);
    }
    if (body.currency !== undefined) {
      if (typeof body.currency !== "string" || body.currency.length > 6) {
        return NextResponse.json(
          { success: false, error: "Invalid currency code" },
          { status: 400 }
        );
      }
      updates.currency = body.currency;
    }
    if (body.vendorId !== undefined) {
      updates.vendorId = body.vendorId || null;
    }
    if (body.dueDate !== undefined) {
      if (body.dueDate === null || body.dueDate === "") {
        updates.dueDate = null;
      } else {
        const parsed = new Date(body.dueDate);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            { success: false, error: "Invalid dueDate" },
            { status: 400 }
          );
        }
        updates.dueDate = parsed;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No updates provided" },
        { status: 400 }
      );
    }

    const updated = await db.budgetItem.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ success: true, data: formatItem(updated) });
  } catch (error) {
    console.error("[PLANNER BUDGET PATCH] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update budget item" },
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
        { success: false, error: "Budget item id is required" },
        { status: 400 }
      );
    }

    const existing = await db.budgetItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Budget item not found" },
        { status: 404 }
      );
    }

    await db.budgetItem.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (error) {
    console.error("[PLANNER BUDGET DELETE] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete budget item" },
      { status: 500 }
    );
  }
}
