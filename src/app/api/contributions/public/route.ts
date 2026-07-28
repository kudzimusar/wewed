import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/* ============================================================
   /api/contributions/public
   ------------------------------------------------------------
   Public endpoint for the approved/featured guest contribution
   wall. No auth required.

   Returns ONLY fields safe for public display:
     - displayName (anonymized if privacy='anonymous')
     - relationship
     - type
     - message
     - photoUrl
     - favoriteSong
     - privacy

   Does NOT return: moderatorNotes, editCount, revisionHistory,
   guestId, reviewedBy, etc.

   Sort order:
     1. featured first
     2. then by submittedAt desc (most recent first)

   Filter:
     - privacy='couple_only' rows are EXCLUDED from this public
       endpoint (they only show in the couple's admin view).
     - privacy='anonymous' rows have displayName replaced with
       'Anonymous'.
     - privacy='public' rows show as-is.
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PublicContribution {
  id: string;
  type: string;
  displayName: string;
  relationship: string | null;
  message: string;
  photoUrl: string | null;
  favoriteSong: string | null;
  privacy: string;
  isFeatured: boolean;
  submittedAt: string | null;
}

// ─── GET /api/contributions/public ──────────────────────────────────────────

export async function GET() {
  try {
    const wedding = await db.wedding.findFirst({
      where: { slug: FLAGSHIP_SLUG },
      select: { id: true },
    });

    if (!wedding) {
      return NextResponse.json({
        success: true,
        count: 0,
        data: [] as PublicContribution[],
      });
    }

    // Pull approved + featured, exclude couple_only (couple-private).
    const rows = await db.guestContribution.findMany({
      where: {
        weddingId: wedding.id,
        status: { in: ["approved", "featured"] },
        privacy: { not: "couple_only" },
      },
      select: {
        id: true,
        type: true,
        displayName: true,
        relationship: true,
        message: true,
        photoUrl: true,
        favoriteSong: true,
        privacy: true,
        status: true,
        submittedAt: true,
      },
      orderBy: [
        // featured first, then most recent
        { submittedAt: "desc" },
      ],
    });

    const data: PublicContribution[] = rows
      .map((r) => ({
        id: r.id,
        type: r.type,
        displayName:
          r.privacy === "anonymous" ? "Anonymous" : r.displayName,
        relationship:
          r.privacy === "anonymous" ? null : r.relationship,
        message: r.message,
        photoUrl: r.privacy === "anonymous" ? null : r.photoUrl,
        favoriteSong: r.privacy === "anonymous" ? null : r.favoriteSong,
        privacy: r.privacy,
        isFeatured: r.status === "featured",
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      }))
      // Stable sort: featured first (preserving submittedAt order within each group)
      .sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        // Within the same featured group, most recent first.
        const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bTime - aTime;
      });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("[CONTRIBUTIONS PUBLIC GET] Error:", error);
    // Even on error, return an empty list so the public wall never breaks.
    return NextResponse.json({
      success: true,
      count: 0,
      data: [] as PublicContribution[],
    });
  }
}
