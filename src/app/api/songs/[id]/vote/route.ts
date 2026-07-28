import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ─── POST /api/songs/[id]/vote ───────────────────────────────────────────────
// Increment vote count for a song (MVP: no auth needed)

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Song ID is required" },
        { status: 400 }
      );
    }

    // Check if the song exists in the database
    const existing = await db.song.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Song not found" },
        { status: 404 }
      );
    }

    // Increment the vote count
    const updated = await db.song.update({
      where: { id },
      data: {
        votes: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      votes: updated.votes,
      data: updated,
    });
  } catch (error) {
    console.error("[SONG VOTE POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to vote for song" },
      { status: 500 }
    );
  }
}
