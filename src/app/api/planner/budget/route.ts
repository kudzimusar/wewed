import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   /api/planner/budget
   ------------------------------------------------------------
   • GET  → list all budget items + summary (total estimated,
            total actual, total paid, remaining)
   • POST → create a new budget item

   Same soft admin gate pattern as /api/planner/tasks.
   ============================================================ */

const ADMIN_COOKIE_KEY = "wewed_admin_auth";
const NONCE_PATTERN = /^[a-f0-9]{16}$/;
const FLAGSHIP_SLUG = "charity-and-kudzie";

// Budget categories — slightly different from task categories
// (more aligned with money flow, includes "Miscellaneous")
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

async function getFlagshipWeddingId(): Promise<string | null> {
  const w = await db.wedding.findFirst({
    where: { slug: FLAGSHIP_SLUG },
    select: { id: true },
  });
  return w?.id ?? null;
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

// ─── GET /api/planner/budget ────────────────────────────────
export async function GET() {
  try {
    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: "Flagship wedding not found. Seed the database first." },
        { status: 404 }
      );
    }

    const items = await db.budgetItem.findMany({
      where: { weddingId },
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    });

    // Compute summary
    const totalEstimated = items.reduce((acc, i) => acc + (i.estimatedCost || 0), 0);
    const totalActual = items.reduce((acc, i) => acc + (i.actualCost ?? i.estimatedCost ?? 0), 0);
    const totalPaid = items.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
    const totalOutstanding = Math.max(0, totalActual - totalPaid);

    // Category breakdown
    const categoryMap = new Map<
      string,
      { estimated: number; actual: number; paid: number; count: number }
    >();
    for (const i of items) {
      const cur = categoryMap.get(i.category) ?? {
        estimated: 0,
        actual: 0,
        paid: 0,
        count: 0,
      };
      cur.estimated += i.estimatedCost || 0;
      cur.actual += i.actualCost ?? i.estimatedCost ?? 0;
      cur.paid += i.paidAmount || 0;
      cur.count += 1;
      categoryMap.set(i.category, cur);
    }
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, v]) => ({
        category,
        estimated: v.estimated,
        actual: v.actual,
        paid: v.paid,
        outstanding: Math.max(0, v.actual - v.paid),
        count: v.count,
      }))
      .sort((a, b) => b.estimated - a.estimated);

    return NextResponse.json({
      success: true,
      count: items.length,
      data: items.map(formatItem),
      summary: {
        totalEstimated,
        totalActual,
        totalPaid,
        totalOutstanding,
        currency: items[0]?.currency ?? "USD",
        percentPaid: totalActual > 0 ? Math.round((totalPaid / totalActual) * 100) : 0,
        percentActualOfEstimated:
          totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0,
      },
      byCategory,
    });
  } catch (error) {
    console.error("[PLANNER BUDGET GET] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch budget items" },
      { status: 500 }
    );
  }
}

// ─── POST /api/planner/budget ───────────────────────────────
interface CreateBudgetPayload {
  category?: string;
  description?: string;
  estimatedCost?: number;
  actualCost?: number | null;
  paidAmount?: number;
  currency?: string;
  vendorId?: string;
  dueDate?: string | null;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as CreateBudgetPayload;

    if (
      !body.description ||
      typeof body.description !== "string" ||
      body.description.trim().length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "Description is required" },
        { status: 400 }
      );
    }

    const category = (BUDGET_CATEGORIES as readonly string[]).includes(body.category ?? "")
      ? body.category!
      : "miscellaneous";

    const estimatedCost =
      typeof body.estimatedCost === "number" && !Number.isNaN(body.estimatedCost)
        ? Math.max(0, body.estimatedCost)
        : 0;

    const actualCost =
      typeof body.actualCost === "number" && !Number.isNaN(body.actualCost)
        ? Math.max(0, body.actualCost)
        : null;

    const paidAmount =
      typeof body.paidAmount === "number" && !Number.isNaN(body.paidAmount)
        ? Math.max(0, body.paidAmount)
        : 0;

    const currency = typeof body.currency === "string" && body.currency.length <= 6
      ? body.currency
      : "USD";

    let dueDate: Date | null = null;
    if (body.dueDate) {
      const parsed = new Date(body.dueDate);
      if (!Number.isNaN(parsed.getTime())) dueDate = parsed;
    }

    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: "Flagship wedding not found. Seed the database first." },
        { status: 404 }
      );
    }

    const item = await db.budgetItem.create({
      data: {
        category,
        description: body.description.trim(),
        estimatedCost,
        actualCost,
        paidAmount,
        currency,
        vendorId: body.vendorId || null,
        dueDate,
        weddingId,
      },
    });

    return NextResponse.json(
      { success: true, data: formatItem(item) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[PLANNER BUDGET POST] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create budget item" },
      { status: 500 }
    );
  }
}
