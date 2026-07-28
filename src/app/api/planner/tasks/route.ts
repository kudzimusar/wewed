import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   /api/planner/tasks
   ------------------------------------------------------------
   • GET  → list all planner tasks for the flagship wedding
            (sorted by order, then createdAt)
   • POST → create a new task

   Admin gate (soft, see /api/privacy for the same pattern):
   trust the `wewed_admin_auth` cookie nonce OR `?admin=1` in
   non-production. NextAuth (Phase 5) will replace this.
   ============================================================ */

const ADMIN_COOKIE_KEY = "wewed_admin_auth";
const NONCE_PATTERN = /^[a-f0-9]{16}$/;
const FLAGSHIP_SLUG = "charity-and-kudzie";

// Categories that map to the Zimbabwean wedding-planning taxonomy
const CATEGORIES = [
  "venue",
  "catering",
  "attire",
  "roora",
  "magumo",
  "transport",
  "stationery",
  "decor",
  "photo_video",
  "music",
  "other",
] as const;
type Category = (typeof CATEGORIES)[number];

const STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
type Status = (typeof STATUSES)[number];

const PRIORITIES = ["low", "medium", "high"] as const;
type Priority = (typeof PRIORITIES)[number];

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

// ─── GET /api/planner/tasks ─────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: "Flagship wedding not found. Seed the database first." },
        { status: 404 }
      );
    }

    const tasks = await db.plannerTask.findMany({
      where: { weddingId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      success: true,
      count: tasks.length,
      data: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        assignee: t.assignee,
        order: t.order,
        weddingId: t.weddingId,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[PLANNER TASKS GET] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch planner tasks" },
      { status: 500 }
    );
  }
}

// ─── POST /api/planner/tasks ────────────────────────────────
interface CreateTaskPayload {
  title?: string;
  description?: string;
  category?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assignee?: string;
}

export async function POST(request: NextRequest) {
  // 1) Admin gate
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as CreateTaskPayload;

    // 2) Validate required fields
    if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    const category: Category = (CATEGORIES as readonly string[]).includes(body.category ?? "")
      ? (body.category as Category)
      : "other";

    const status: Status = (STATUSES as readonly string[]).includes(body.status ?? "")
      ? (body.status as Status)
      : "todo";

    const priority: Priority = (PRIORITIES as readonly string[]).includes(body.priority ?? "")
      ? (body.priority as Priority)
      : "medium";

    let dueDate: Date | null = null;
    if (body.dueDate) {
      const parsed = new Date(body.dueDate);
      if (!Number.isNaN(parsed.getTime())) dueDate = parsed;
    }

    // 3) Resolve wedding
    const weddingId = await getFlagshipWeddingId();
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: "Flagship wedding not found. Seed the database first." },
        { status: 404 }
      );
    }

    // 4) Get the next order value
    const lastTask = await db.plannerTask.findFirst({
      where: { weddingId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (lastTask?.order ?? 0) + 1;

    // 5) Create the task
    const task = await db.plannerTask.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        category,
        status,
        priority,
        dueDate,
        assignee: body.assignee?.trim() || null,
        order: nextOrder,
        weddingId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: task.id,
          title: task.title,
          description: task.description,
          category: task.category,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate ? task.dueDate.toISOString() : null,
          assignee: task.assignee,
          order: task.order,
          weddingId: task.weddingId,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[PLANNER TASKS POST] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create task" },
      { status: 500 }
    );
  }
}
