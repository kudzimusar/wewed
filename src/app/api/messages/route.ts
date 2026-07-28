import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ─── Hardcoded Sample Messages ───────────────────────────────────────────────

const SAMPLE_MESSAGES = [
  {
    id: "sample-1",
    type: "wall",
    content: "Wishing you a lifetime of love and happiness! 🤍",
    authorName: "Tendai M.",
    isPublic: true,
    createdAt: new Date("2026-01-15T10:00:00Z").toISOString(),
  },
  {
    id: "sample-2",
    type: "wall",
    content: "Charity & Kudzie, you two are proof that true love exists. Makorokoto!",
    authorName: "Rumbidzai C.",
    isPublic: true,
    createdAt: new Date("2026-02-20T14:30:00Z").toISOString(),
  },
  {
    id: "sample-3",
    type: "wall",
    content:
      "From the first day I met you both, I knew this was forever. So happy for you!",
    authorName: "Takudzwa M.",
    isPublic: true,
    createdAt: new Date("2026-03-10T09:15:00Z").toISOString(),
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessagePayload {
  type: string;
  content: string;
  authorName: string;
  authorToken?: string;
  weddingId?: string;
}

// ─── GET /api/messages ───────────────────────────────────────────────────────
// Return messages for the guest wall.
// Falls back to hardcoded sample messages when DB is empty.

export async function GET() {
  try {
    const wedding = await db.wedding.findFirst({
      where: { slug: "charity-and-kudzie" },
    });

    if (wedding) {
      const dbMessages = await db.message.findMany({
        where: {
          weddingId: wedding.id,
          isPublic: true,
        },
        orderBy: { createdAt: "desc" },
      });

      if (dbMessages.length > 0) {
        return NextResponse.json({
          success: true,
          source: "database",
          count: dbMessages.length,
          data: dbMessages,
        });
      }
    }

    // Fallback: return sample messages
    return NextResponse.json({
      success: true,
      source: "hardcoded",
      count: SAMPLE_MESSAGES.length,
      data: SAMPLE_MESSAGES,
    });
  } catch (error) {
    console.error("[MESSAGES GET] Error:", error);

    // Even on DB error, still return sample messages
    return NextResponse.json({
      success: true,
      source: "hardcoded_fallback",
      count: SAMPLE_MESSAGES.length,
      data: SAMPLE_MESSAGES,
    });
  }
}

// ─── POST /api/messages ──────────────────────────────────────────────────────
// Add a message to the guest wall

export async function POST(request: NextRequest) {
  try {
    const body: MessagePayload = await request.json();

    // Validate
    if (!body.content || typeof body.content !== "string" || body.content.trim().length === 0) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }
    if (!body.authorName || typeof body.authorName !== "string" || body.authorName.trim().length === 0) {
      return NextResponse.json(
        { error: "Author name is required" },
        { status: 400 }
      );
    }

    // Find the flagship wedding
    const weddingId =
      body.weddingId ??
      (await db.wedding.findFirst({ where: { slug: "charity-and-kudzie" } }))?.id;

    if (!weddingId) {
      return NextResponse.json(
        { error: "No wedding found. Please seed the database first." },
        { status: 404 }
      );
    }

    const message = await db.message.create({
      data: {
        type: body.type ?? "wall",
        content: body.content.trim(),
        authorName: body.authorName.trim(),
        authorToken: body.authorToken || null,
        isPublic: true,
        weddingId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: message,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[MESSAGES POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to add message" },
      { status: 500 }
    );
  }
}
