import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RSVPPayload {
  name: string;
  email?: string;
  attending?: boolean;
  mealChoice?: string;
  plusOne?: boolean;
  plusOneName?: string;
  plusOneMeal?: string;
  kidsAttending?: boolean;
  kidsCount?: number;
  songRequests?: string;
  dietaryNotes?: string;
  message?: string;
  weddingId?: string;
}

// ─── POST /api/rsvp ──────────────────────────────────────────────────────────
// Create a new Guest + RSVP record, return the unique token

export async function POST(request: NextRequest) {
  try {
    const body: RSVPPayload = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Find the flagship wedding (or use provided weddingId)
    const weddingId =
      body.weddingId ??
      (await db.wedding.findFirst({ where: { slug: "charity-and-kudzie" } }))?.id;

    if (!weddingId) {
      return NextResponse.json(
        { error: "No wedding found. Please seed the database first." },
        { status: 404 }
      );
    }

    const token = uuidv4();

    // Create Guest + RSVP in a transaction
    const result = await db.$transaction(async (tx) => {
      const guest = await tx.guest.create({
        data: {
          name: body.name.trim(),
          email: body.email?.trim() || null,
          role: "guest",
          weddingId,
        },
      });

      const rsvp = await tx.rSVP.create({
        data: {
          token,
          attending: body.attending ?? null,
          mealChoice: body.mealChoice || null,
          plusOne: body.plusOne ?? false,
          plusOneName: body.plusOneName?.trim() || null,
          plusOneMeal: body.plusOneMeal || null,
          kidsAttending: body.kidsAttending ?? false,
          kidsCount: body.kidsCount ?? 0,
          songRequests: body.songRequests || null,
          dietaryNotes: body.dietaryNotes?.trim() || null,
          message: body.message?.trim() || null,
          guestId: guest.id,
        },
      });

      return { guest, rsvp };
    });

    return NextResponse.json(
      {
        success: true,
        token: result.rsvp.token,
        guest: {
          id: result.guest.id,
          name: result.guest.name,
          email: result.guest.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[RSVP POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to create RSVP" },
      { status: 500 }
    );
  }
}

// ─── GET /api/rsvp ───────────────────────────────────────────────────────────
// List all RSVPs (admin purpose)

export async function GET() {
  try {
    const rsvps = await db.rSVP.findMany({
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            side: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      count: rsvps.length,
      data: rsvps,
    });
  } catch (error) {
    console.error("[RSVP GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch RSVPs" },
      { status: 500 }
    );
  }
}
