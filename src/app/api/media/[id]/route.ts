import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// ─── Constants ────────────────────────────────────────────────────────────────

const PUBLIC_DIR = path.join(process.cwd(), "public");

const MOMENT_VALUES = new Set([
  "ceremony",
  "reception",
  "candid",
  "preparation",
  "group_photo",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaPatch {
  caption?: string | null;
  moment?: string | null;
  isCurated?: boolean;
  isHero?: boolean;
}

// ─── GET /api/media/[id] ──────────────────────────────────────────────────────
// Fetch a single media item by id.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Media id is required." },
        { status: 400 }
      );
    }

    const media = await db.mediaItem.findUnique({ where: { id } });

    if (!media) {
      return NextResponse.json(
        { error: "Media not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      media: {
        ...media,
        uploadedAt: media.uploadedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[MEDIA ID GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch media." },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/media/[id] ────────────────────────────────────────────────────
// Update caption, moment, isCurated, isHero (admin).

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Media id is required." },
        { status: 400 }
      );
    }

    const body: MediaPatch = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.caption !== undefined) {
      if (body.caption === null) {
        updateData.caption = null;
      } else if (typeof body.caption === "string") {
        updateData.caption = body.caption.trim().slice(0, 500) || null;
      }
    }

    if (body.moment !== undefined) {
      if (body.moment === null || body.moment === "") {
        updateData.moment = null;
      } else if (typeof body.moment === "string" && MOMENT_VALUES.has(body.moment)) {
        updateData.moment = body.moment;
      } else {
        return NextResponse.json(
          { error: `Invalid moment. Allowed: ${[...MOMENT_VALUES].join(", ")}` },
          { status: 400 }
        );
      }
    }

    if (typeof body.isCurated === "boolean") updateData.isCurated = body.isCurated;
    if (typeof body.isHero === "boolean") updateData.isHero = body.isHero;

    const existing = await db.mediaItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Media not found." },
        { status: 404 }
      );
    }

    const updated = await db.mediaItem.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      media: {
        ...updated,
        uploadedAt: updated.uploadedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[MEDIA ID PATCH] Error:", error);
    return NextResponse.json(
      { error: "Failed to update media." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/media/[id] ───────────────────────────────────────────────────
// Delete a media item and remove its file from disk.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Media id is required." },
        { status: 400 }
      );
    }

    const existing = await db.mediaItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Media not found." },
        { status: 404 }
      );
    }

    // Attempt to delete the file from disk.
    if (existing.url && existing.url.startsWith("/uploads/")) {
      const filePath = path.join(PUBLIC_DIR, existing.url);
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch {
        // File may already be gone — non-fatal.
      }
    }

    await db.mediaItem.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      deleted: id,
    });
  } catch (error) {
    console.error("[MEDIA ID DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete media." },
      { status: 500 }
    );
  }
}
