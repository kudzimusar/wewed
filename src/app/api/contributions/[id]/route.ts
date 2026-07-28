import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { sanitizeSingleLine } from "@/lib/contribution-utils";

/* ============================================================
   /api/contributions/[id]
   ------------------------------------------------------------
   Admin-only moderation endpoint for a single guest contribution.

   • PATCH → update the status (and optional moderator notes).
              Sets reviewedAt + reviewedBy, and syncs the guest's
              contributionStatus field to match.

   Allowed statuses:
     - approved   → public on the guest wall
     - rejected   → not public, guest cannot resubmit
     - featured   → public, pinned to the top
     - hidden     → not public, but guest retains approved state

   Admin gate: wewed_admin_auth cookie (or ?admin=1 in dev).
   ============================================================ */

// ─── Types ──────────────────────────────────────────────────────────────────

interface PatchPayload {
  status?: string;
  moderatorNotes?: string;
}

const ALLOWED_STATUSES = ["approved", "rejected", "featured", "hidden"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

// ─── PATCH /api/contributions/[id] ──────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = requireAdmin(request);
  if (gate) return gate;

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Contribution id is required." },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => null)) as PatchPayload | null;
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    // ── Validate status ──────────────────────────────────────────────────
    if (!body.status || !(ALLOWED_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    const newStatus = body.status as AllowedStatus;

    // ── Validate moderatorNotes (optional, single line, max 1000 chars) ──
    let moderatorNotes: string | null = null;
    if (body.moderatorNotes !== undefined && body.moderatorNotes !== null) {
      moderatorNotes = sanitizeSingleLine(body.moderatorNotes);
      if (moderatorNotes.length > 1000) {
        return NextResponse.json(
          {
            success: false,
            error: "Moderator notes must be 1000 characters or fewer.",
          },
          { status: 400 }
        );
      }
      if (moderatorNotes.length === 0) moderatorNotes = null;
    }

    // ── Load the contribution ────────────────────────────────────────────
    const existing = await db.guestContribution.findUnique({
      where: { id },
      select: { id: true, guestId: true, status: true, moderatorNotes: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Contribution not found." },
        { status: 404 }
      );
    }

    // ── Apply update ─────────────────────────────────────────────────────
    const now = new Date();
    const updated = await db.guestContribution.update({
      where: { id },
      data: {
        status: newStatus,
        // Only overwrite moderatorNotes if the caller sent one.
        ...(moderatorNotes !== null
          ? { moderatorNotes }
          : body.moderatorNotes === null
            ? { moderatorNotes: null }
            : {}),
        reviewedAt: now,
        reviewedBy: "admin",
      },
    });

    // ── Sync guest.contributionStatus ────────────────────────────────────
    // The guest's status mirrors the contribution's status so the couple
    // can see at a glance who has been approved / rejected / featured.
    await db.guest.update({
      where: { id: existing.guestId },
      data: { contributionStatus: newStatus },
    });

    return NextResponse.json({
      success: true,
      contribution: {
        id: updated.id,
        type: updated.type,
        displayName: updated.displayName,
        relationship: updated.relationship,
        message: updated.message,
        photoUrl: updated.photoUrl,
        favoriteSong: updated.favoriteSong,
        privacy: updated.privacy,
        status: updated.status,
        moderatorNotes: updated.moderatorNotes,
        wordCount: updated.wordCount,
        charCount: updated.charCount,
        editCount: updated.editCount,
        submittedAt: updated.submittedAt
          ? updated.submittedAt.toISOString()
          : null,
        reviewedAt: updated.reviewedAt
          ? updated.reviewedAt.toISOString()
          : null,
        reviewedBy: updated.reviewedBy,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[CONTRIBUTION PATCH] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update contribution." },
      { status: 500 }
    );
  }
}
