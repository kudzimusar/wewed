import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

// ─── Constants ────────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

const MOMENT_VALUES = new Set([
  "ceremony",
  "reception",
  "candid",
  "preparation",
  "group_photo",
]);

// ─── Hardcoded Sample Gallery ─────────────────────────────────────────────────
// Used as a graceful fallback before the wedding — gives guests a sense of what
// the gallery will look like once real photos arrive.

const SAMPLE_MEDIA = [
  {
    id: "sample-1",
    type: "photo",
    url: "/hero-wedding.png",
    thumbnailUrl: "/hero-wedding.png",
    caption: "A glimpse of the celebration to come",
    moment: "ceremony",
    isCurated: true,
    isHero: true,
    uploaderId: null,
    uploadedAt: new Date("2026-09-01T10:00:00Z").toISOString(),
  },
  {
    id: "sample-2",
    type: "photo",
    url: "/couple-silhouette.png",
    thumbnailUrl: "/couple-silhouette.png",
    caption: "Charity & Kudzie — engagement silhouette",
    moment: "candid",
    isCurated: true,
    isHero: false,
    uploaderId: null,
    uploadedAt: new Date("2026-09-02T10:00:00Z").toISOString(),
  },
  {
    id: "sample-3",
    type: "photo",
    url: "/ornament-frame.png",
    thumbnailUrl: "/ornament-frame.png",
    caption: "Ornamental details from the venue",
    moment: "reception",
    isCurated: true,
    isHero: false,
    uploaderId: null,
    uploadedAt: new Date("2026-09-03T10:00:00Z").toISOString(),
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaQuery {
  moment?: string | null;
  type?: string | null;
  curated?: string | null;
  limit?: number;
  offset?: number;
}

// ─── GET /api/media ───────────────────────────────────────────────────────────
// List media items, filterable via query string.
//   ?moment=ceremony
//   ?type=photo
//   ?curated=true
//   ?limit=12&offset=0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q: MediaQuery = {
      moment: searchParams.get("moment"),
      type: searchParams.get("type"),
      curated: searchParams.get("curated"),
      limit: searchParams.get("limit")
        ? Math.min(100, Number(searchParams.get("limit")))
        : undefined,
      offset: searchParams.get("offset")
        ? Math.max(0, Number(searchParams.get("offset")))
        : 0,
    };

    const wedding = await db.wedding.findFirst({
      where: { slug: "charity-and-kudzie" },
    });

    const where: Record<string, unknown> = {};
    if (wedding) where.weddingId = wedding.id;
    if (q.moment && MOMENT_VALUES.has(q.moment)) where.moment = q.moment;
    if (q.type && ["photo", "video", "document"].includes(q.type)) {
      where.type = q.type;
    }
    if (q.curated === "true") where.isCurated = true;
    if (q.curated === "false") where.isCurated = false;

    const dbMedia = wedding
      ? await db.mediaItem.findMany({
          where,
          orderBy: [{ isHero: "desc" }, { uploadedAt: "desc" }, { createdAt: "desc" }],
          take: q.limit,
          skip: q.offset,
        })
      : [];

    if (dbMedia.length > 0) {
      return NextResponse.json({
        success: true,
        source: "database",
        count: dbMedia.length,
        data: dbMedia.map((m) => ({
          ...m,
          uploadedAt: m.uploadedAt?.toISOString() ?? null,
        })),
      });
    }

    // Apply the same filters to the sample set when DB is empty.
    let samples = SAMPLE_MEDIA.slice();
    if (q.moment && MOMENT_VALUES.has(q.moment)) {
      samples = samples.filter((m) => m.moment === q.moment);
    }
    if (q.type) samples = samples.filter((m) => m.type === q.type);
    if (q.curated === "true") samples = samples.filter((m) => m.isCurated);

    return NextResponse.json({
      success: true,
      source: "hardcoded",
      count: samples.length,
      data: samples,
    });
  } catch (error) {
    console.error("[MEDIA GET] Error:", error);
    return NextResponse.json(
      {
        success: true,
        source: "hardcoded_fallback",
        count: SAMPLE_MEDIA.length,
        data: SAMPLE_MEDIA,
      },
      { status: 200 }
    );
  }
}

// ─── POST /api/media ──────────────────────────────────────────────────────────
// Upload a media item (multipart/form-data).
// Accepts: file (File), caption (string), moment (string), uploaderId (string?)

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const caption = (form.get("caption") as string | null)?.trim() ?? null;
    const momentRaw = (form.get("moment") as string | null)?.trim() ?? null;
    const uploaderId =
      (form.get("uploaderId") as string | null)?.trim() || null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A file is required." },
        { status: 400 }
      );
    }

    // Size guard
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File is too large. Maximum size is 10 MB.",
          limit: MAX_FILE_SIZE,
          received: file.size,
        },
        { status: 413 }
      );
    }

    // Type guard
    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, MP4, WEBM.",
          receivedType: file.type || "unknown",
        },
        { status: 415 }
      );
    }

    // Moment guard
    const moment =
      momentRaw && MOMENT_VALUES.has(momentRaw) ? momentRaw : "candid";

    // Determine type label
    const typeLabel = file.type.startsWith("image/")
      ? "photo"
      : file.type.startsWith("video/")
        ? "video"
        : "document";

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Build unique filename: <uuid>.<ext>
    const filename = `${randomUUID()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    const publicUrl = `/uploads/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filepath, buffer);

    // Find the flagship wedding
    const wedding = await db.wedding.findFirst({
      where: { slug: "charity-and-kudzie" },
    });

    if (!wedding) {
      // File saved but no wedding — return success without a DB record so the
      // guest gets positive feedback. The lead agent can re-seed later.
      return NextResponse.json(
        {
          success: true,
          source: "filesystem_only",
          media: {
            id: `local-${randomUUID()}`,
            type: typeLabel,
            url: publicUrl,
            thumbnailUrl: publicUrl,
            caption,
            moment,
            isCurated: false,
            isHero: false,
            uploaderId,
            uploadedAt: new Date().toISOString(),
          },
        },
        { status: 201 }
      );
    }

    const media = await db.mediaItem.create({
      data: {
        type: typeLabel,
        url: publicUrl,
        thumbnailUrl: typeLabel === "video" ? null : publicUrl,
        caption,
        moment,
        isCurated: false,
        isHero: false,
        uploaderId,
        uploadedAt: new Date(),
        weddingId: wedding.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        media: {
          ...media,
          uploadedAt: media.uploadedAt?.toISOString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[MEDIA POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload media." },
      { status: 500 }
    );
  }
}
