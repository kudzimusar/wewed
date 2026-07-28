import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ─── Hardcoded Song List ─────────────────────────────────────────────────────
// Used when the database has no songs yet (pre-seed)

const HARDCODED_SONGS = [
  // Ceremony
  { id: "hc-1", title: "Ave Maria", artist: "Franz Schubert", phase: "ceremony", moment: "Processional", votes: 0, order: 1 },
  { id: "hc-2", title: "Here Comes The Sun", artist: "The Beatles", phase: "bridal_entrance", moment: "Bridal Entrance", votes: 0, order: 2 },
  { id: "hc-3", title: "All You Need Is Love", artist: "The Beatles", phase: "recessional", moment: "Recessional", votes: 0, order: 3 },

  // Reception
  { id: "hc-4", title: "September", artist: "Earth, Wind & Fire", phase: "reception", moment: null, votes: 0, order: 4 },
  { id: "hc-5", title: "Lovely Day", artist: "Bill Withers", phase: "reception", moment: null, votes: 0, order: 5 },
  { id: "hc-6", title: "Isn't She Lovely", artist: "Stevie Wonder", phase: "reception", moment: null, votes: 0, order: 6 },
  { id: "hc-7", title: "We Are Family", artist: "Sister Sledge", phase: "reception", moment: null, votes: 0, order: 7 },
  { id: "hc-8", title: "Dancing in the Moonlight", artist: "King Harvest", phase: "reception", moment: null, votes: 0, order: 8 },
  { id: "hc-9", title: "Svikiro", artist: "Mokoomba", phase: "reception", moment: null, votes: 0, order: 9 },
  { id: "hc-10", title: "Neria", artist: "Oliver Mtukudzi", phase: "reception", moment: null, votes: 0, order: 10 },
  { id: "hc-11", title: "Chikwata", artist: "Alick Macheso", phase: "reception", moment: null, votes: 0, order: 11 },
  { id: "hc-12", title: "Sweet Caroline", artist: "Neil Diamond", phase: "reception", moment: null, votes: 0, order: 12 },
  { id: "hc-13", title: "I Wanna Dance with Somebody", artist: "Whitney Houston", phase: "reception", moment: null, votes: 0, order: 13 },
  { id: "hc-14", title: "Hey Jude", artist: "The Beatles", phase: "reception", moment: null, votes: 0, order: 14 },
  { id: "hc-15", title: "Don't Stop Me Now", artist: "Queen", phase: "reception", moment: null, votes: 0, order: 15 },
  { id: "hc-16", title: "Stand By Me", artist: "Ben E. King", phase: "reception", moment: null, votes: 0, order: 16 },
  { id: "hc-17", title: "Put Your Records On", artist: "Corinne Bailey Rae", phase: "reception", moment: null, votes: 0, order: 17 },
  { id: "hc-18", title: "You're My Best Friend", artist: "Queen", phase: "reception", moment: null, votes: 0, order: 18 },
  { id: "hc-19", title: "Saturday Night", artist: "Whigfield", phase: "reception", moment: null, votes: 0, order: 19 },
  { id: "hc-20", title: "Masquerade", artist: "Alick Macheso", phase: "reception", moment: null, votes: 0, order: 20 },
  { id: "hc-21", title: "Chitekete", artist: "Oliver Mtukudzi", phase: "reception", moment: null, votes: 0, order: 21 },
  { id: "hc-22", title: "Malaika", artist: "Miriam Makeba", phase: "reception", moment: null, votes: 0, order: 22 },

  // First Dance
  { id: "hc-23", title: "At Last", artist: "Etta James", phase: "first_dance", moment: "First Dance", votes: 0, order: 23 },
  { id: "hc-24", title: "Perfect", artist: "Ed Sheeran", phase: "first_dance", moment: "First Dance", votes: 0, order: 24 },
  { id: "hc-25", title: "Thinking Out Loud", artist: "Ed Sheeran", phase: "first_dance", moment: "First Dance", votes: 0, order: 25 },
  { id: "hc-26", title: "A Thousand Years", artist: "Christina Perri", phase: "first_dance", moment: "First Dance", votes: 0, order: 26 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SongRequestPayload {
  title: string;
  artist: string;
  phase?: string;
  moment?: string;
  weddingId?: string;
}

// ─── GET /api/songs ──────────────────────────────────────────────────────────
// Return all songs for the flagship wedding.
// Falls back to the hardcoded list when the DB has no songs.

export async function GET() {
  try {
    const wedding = await db.wedding.findFirst({
      where: { slug: "charity-and-kudzie" },
    });

    if (wedding) {
      const dbSongs = await db.song.findMany({
        where: { weddingId: wedding.id },
        orderBy: [{ order: "asc" }, { title: "asc" }],
      });

      if (dbSongs.length > 0) {
        return NextResponse.json({
          success: true,
          source: "database",
          count: dbSongs.length,
          data: dbSongs,
        });
      }
    }

    // Fallback: return hardcoded list
    return NextResponse.json({
      success: true,
      source: "hardcoded",
      count: HARDCODED_SONGS.length,
      data: HARDCODED_SONGS,
    });
  } catch (error) {
    console.error("[SONGS GET] Error:", error);

    // Even on DB error, still return the hardcoded list so the UI works
    return NextResponse.json({
      success: true,
      source: "hardcoded_fallback",
      count: HARDCODED_SONGS.length,
      data: HARDCODED_SONGS,
    });
  }
}

// ─── POST /api/songs ─────────────────────────────────────────────────────────
// Add a guest song request (phase: "requested")

export async function POST(request: NextRequest) {
  try {
    const body: SongRequestPayload = await request.json();

    // Validate
    if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
      return NextResponse.json(
        { error: "Song title is required" },
        { status: 400 }
      );
    }
    if (!body.artist || typeof body.artist !== "string" || body.artist.trim().length === 0) {
      return NextResponse.json(
        { error: "Artist name is required" },
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

    // Determine the order for the new song (place at end)
    const maxOrder = await db.song.aggregate({
      where: { weddingId },
      _max: { order: true },
    });

    const song = await db.song.create({
      data: {
        title: body.title.trim(),
        artist: body.artist.trim(),
        phase: body.phase ?? "requested",
        moment: body.moment?.trim() || null,
        order: (maxOrder._max.order ?? 0) + 1,
        votes: 1, // The requester's vote counts
        weddingId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: song,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SONGS POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to add song request" },
      { status: 500 }
    );
  }
}
