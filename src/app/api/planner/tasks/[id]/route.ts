import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   /api/planner/tasks/[id]
   ------------------------------------------------------------
   • PATCH  → update any fields on a task
   • DELETE → remove a task
   ============================================================ */

const ADMIN_COOKIE_KEY = "wewed_admin_auth";
const NONCE_PATTERN = /^[a-f0-9]{16}$/;

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
const STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

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

interface PatchTaskPayload {
  title?: string;
  description?: string | null;
  category?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assignee?: string | null;
  order?: number;
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
        { success: false, error: "Task id is required" },
        { status: 400 }
      );
    }

    const existing = await db.plannerTask.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as PatchTaskPayload;
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || body.title.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Title cannot be empty" },
          { status: 400 }
        );
      }
      updates.title = body.title.trim();
    }
    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null;
    }
    if (body.category !== undefined) {
      if (!(CATEGORIES as readonly string[]).includes(body.category)) {
        return NextResponse.json(
          { success: false, error: `Invalid category. Allowed: ${CATEGORIES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.category = body.category;
    }
    if (body.status !== undefined) {
      if (!(STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Allowed: ${STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }
    if (body.priority !== undefined) {
      if (!(PRIORITIES as readonly string[]).includes(body.priority)) {
        return NextResponse.json(
          { success: false, error: `Invalid priority. Allowed: ${PRIORITIES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.priority = body.priority;
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
    if (body.assignee !== undefined) {
      updates.assignee = body.assignee?.trim() || null;
    }
    if (body.order !== undefined) {
      if (typeof body.order !== "number" || Number.isNaN(body.order)) {
        return NextResponse.json(
          { success: false, error: "order must be a number" },
          { status: 400 }
        );
      }
      updates.order = body.order;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No updates provided" },
        { status: 400 }
      );
    }

    const updated = await db.plannerTask.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        status: updated.status,
        priority: updated.priority,
        dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
        assignee: updated.assignee,
        order: updated.order,
        weddingId: updated.weddingId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[PLANNER TASK PATCH] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update task" },
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
        { success: false, error: "Task id is required" },
        { status: 400 }
      );
    }

    const existing = await db.plannerTask.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }

    await db.plannerTask.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (error) {
    console.error("[PLANNER TASK DELETE] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
