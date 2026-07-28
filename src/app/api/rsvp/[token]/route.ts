import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RSVPUpdatePayload {
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
  checkedIn?: boolean;
}

// ─── GET /api/rsvp/[token] ───────────────────────────────────────────────────
// Look up RSVP by token, return guest details + RSVP status

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const rsvp = await db.rSVP.findUnique({
      where: { token },
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            roleDetail: true,
            side: true,
            tableNumber: true,
          },
        },
      },
    });

    if (!rsvp) {
      return NextResponse.json(
        { error: "RSVP not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rsvp,
    });
  } catch (error) {
    console.error("[RSVP TOKEN GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch RSVP" },
      { status: 500 }
    );
  }
}

// ─── PUT /api/rsvp/[token] ───────────────────────────────────────────────────
// Update RSVP (check-in, details, etc.)

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body: RSVPUpdatePayload = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Verify RSVP exists
    const existing = await db.rSVP.findUnique({ where: { token } });
    if (!existing) {
      return NextResponse.json(
        { error: "RSVP not found" },
        { status: 404 }
      );
    }

    // Build update data — only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (body.attending !== undefined) updateData.attending = body.attending;
    if (body.mealChoice !== undefined) updateData.mealChoice = body.mealChoice;
    if (body.plusOne !== undefined) updateData.plusOne = body.plusOne;
    if (body.plusOneName !== undefined) updateData.plusOneName = body.plusOneName;
    if (body.plusOneMeal !== undefined) updateData.plusOneMeal = body.plusOneMeal;
    if (body.kidsAttending !== undefined) updateData.kidsAttending = body.kidsAttending;
    if (body.kidsCount !== undefined) updateData.kidsCount = body.kidsCount;
    if (body.songRequests !== undefined) updateData.songRequests = body.songRequests;
    if (body.dietaryNotes !== undefined) updateData.dietaryNotes = body.dietaryNotes;
    if (body.message !== undefined) updateData.message = body.message;
    if (body.checkedIn !== undefined) {
      updateData.checkedIn = body.checkedIn;
      updateData.checkedInAt = body.checkedIn ? new Date() : null;
    }

    const updated = await db.rSVP.update({
      where: { token },
      data: updateData,
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("[RSVP TOKEN PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update RSVP" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/rsvp/[token] ─────────────────────────────────────────────────
// Toggle check-in status

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const existing = await db.rSVP.findUnique({ where: { token } });
    if (!existing) {
      return NextResponse.json(
        { error: "RSVP not found" },
        { status: 404 }
      );
    }

    // Toggle check-in
    const newCheckedIn = !existing.checkedIn;
    const updated = await db.rSVP.update({
      where: { token },
      data: {
        checkedIn: newCheckedIn,
        checkedInAt: newCheckedIn ? new Date() : null,
      },
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      checkedIn: newCheckedIn,
      data: updated,
    });
  } catch (error) {
    console.error("[RSVP TOKEN PATCH] Error:", error);
    return NextResponse.json(
      { error: "Failed to toggle check-in" },
      { status: 500 }
    );
  }
}
