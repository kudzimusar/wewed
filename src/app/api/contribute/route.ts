import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import {
  MAX_EDITS,
  appendRevision,
  isContributionType,
  isPrivacyOption,
  sanitizeMessage,
  sanitizeSingleLine,
  validateMessage,
} from "@/lib/contribution-utils";

/* ============================================================
   /api/contribute?token=TOKEN
   ------------------------------------------------------------
   The guest-facing contribution editor endpoint.

   • GET  → fetch the guest's existing draft + status
   • POST → save a draft OR submit the contribution for review

   No admin gate needed — the token IS the auth. Tokens are
   32-char hex, unique per guest, and only readable from the DB.

   Anti-abuse:
   - Message validated against word/char caps + HTML/URL/phone/
     email/profanity rules.
   - editCount <= MAX_EDITS enforced before any save.
   - All text fields sanitized (HTML-escaped) before storage.
   ============================================================ */

// ─── Types ──────────────────────────────────────────────────────────────────

interface ContributePayload {
  type?: string;
  displayName?: string;
  relationship?: string;
  message?: string;
  favoriteSong?: string;
  privacy?: string;
  action?: "draft" | "submit";
}

interface PublicGuestInfo {
  id: string;
  name: string;
  role: string;
  roleDetail: string | null;
  side: string | null;
}

interface PublicContributionInfo {
  id: string;
  type: string;
  displayName: string;
  relationship: string | null;
  message: string;
  photoUrl: string | null;
  favoriteSong: string | null;
  privacy: string;
  status: string;
  wordCount: number;
  charCount: number;
  editCount: number;
  submittedAt: string | null;
  updatedAt: string;
}

// ─── GET /api/contribute?token=TOKEN ────────────────────────────────────────
// Return the guest's existing contribution draft + status.
// 404 if token is invalid.

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token || !/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing token." },
        { status: 404 }
      );
    }

    const guest = await db.guest.findUnique({
      where: { contributionToken: token },
      select: {
        id: true,
        name: true,
        role: true,
        roleDetail: true,
        side: true,
        contributionStatus: true,
        contribution: true,
      },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing token." },
        { status: 404 }
      );
    }

    const publicGuest: PublicGuestInfo = {
      id: guest.id,
      name: guest.name,
      role: guest.role,
      roleDetail: guest.roleDetail,
      side: guest.side,
    };

    const publicContribution: PublicContributionInfo | null = guest.contribution
      ? {
          id: guest.contribution.id,
          type: guest.contribution.type,
          displayName: guest.contribution.displayName,
          relationship: guest.contribution.relationship,
          message: guest.contribution.message,
          photoUrl: guest.contribution.photoUrl,
          favoriteSong: guest.contribution.favoriteSong,
          privacy: guest.contribution.privacy,
          status: guest.contribution.status,
          wordCount: guest.contribution.wordCount,
          charCount: guest.contribution.charCount,
          editCount: guest.contribution.editCount,
          submittedAt: guest.contribution.submittedAt
            ? guest.contribution.submittedAt.toISOString()
            : null,
          updatedAt: guest.contribution.updatedAt.toISOString(),
        }
      : null;

    return NextResponse.json({
      success: true,
      guest: publicGuest,
      contribution: publicContribution,
      status: guest.contributionStatus ?? "none",
    });
  } catch (error) {
    console.error("[CONTRIBUTE GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load contribution." },
      { status: 500 }
    );
  }
}

// ─── POST /api/contribute?token=TOKEN ───────────────────────────────────────
// Save a draft or submit the contribution for review.
//
// Body:
//   { type, displayName, relationship, message, favoriteSong, privacy,
//     action: 'draft' | 'submit' }

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token || !/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing token." },
        { status: 404 }
      );
    }

    const guest = await db.guest.findUnique({
      where: { contributionToken: token },
      include: { contribution: true },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing token." },
        { status: 404 }
      );
    }

    // ── Parse + validate body ────────────────────────────────────────────
    const body = (await request
      .json()
      .catch(() => null)) as ContributePayload | null;
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const action = body.action ?? "draft";
    if (action !== "draft" && action !== "submit") {
      return NextResponse.json(
        { success: false, error: "action must be 'draft' or 'submit'." },
        { status: 400 }
      );
    }

    // Type
    if (!isContributionType(body.type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "type is required and must be one of: memory, advice, blessing, funny_story, wish.",
        },
        { status: 400 }
      );
    }

    // displayName (required)
    const displayName = sanitizeSingleLine(body.displayName ?? "");
    if (!displayName) {
      return NextResponse.json(
        { success: false, error: "Display name is required." },
        { status: 400 }
      );
    }
    if (displayName.length > 80) {
      return NextResponse.json(
        {
          success: false,
          error: "Display name must be 80 characters or fewer.",
        },
        { status: 400 }
      );
    }

    // relationship (optional, single line)
    const relationship =
      sanitizeSingleLine(body.relationship ?? "") || null;

    // favoriteSong (optional, single line)
    const favoriteSong =
      sanitizeSingleLine(body.favoriteSong ?? "") || null;

    // privacy (default 'public')
    const privacy = isPrivacyOption(body.privacy) ? body.privacy : "public";

    // message — sanitize FIRST, then validate the sanitized version
    const sanitizedMessage = sanitizeMessage(body.message ?? "");

    if (action === "submit" && !sanitizedMessage) {
      return NextResponse.json(
        { success: false, error: "Message is required to submit." },
        { status: 400 }
      );
    }

    const validation = validateMessage(sanitizedMessage);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Message failed validation.",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // ── Rate limit: editCount ────────────────────────────────────────────
    // Each POST counts as one edit. After MAX_EDITS, no more saves allowed.
    // (A submission still goes through, since submit is the terminal state.)
    const currentEditCount = guest.contribution?.editCount ?? 0;

    if (action === "draft" && currentEditCount >= MAX_EDITS) {
      return NextResponse.json(
        {
          success: false,
          error: `You have reached the maximum of ${MAX_EDITS} edits. Please submit your contribution or contact the couple.`,
        },
        { status: 429 }
      );
    }

    // ── Compute new fields ───────────────────────────────────────────────
    const wordCount = sanitizedMessage
      ? sanitizedMessage.trim().split(/\s+/).length
      : 0;
    const charCount = sanitizedMessage.length;
    const newEditCount = currentEditCount + 1;
    const now = new Date();

    // ── Build revision history (append previous version) ─────────────────
    let revisionHistory = guest.contribution?.revisionHistory ?? null;
    if (guest.contribution) {
      revisionHistory = appendRevision(revisionHistory, {
        message: guest.contribution.message,
        displayName: guest.contribution.displayName,
        type: guest.contribution.type,
        savedAt: guest.contribution.updatedAt.toISOString(),
      });
    }

    // ── Determine new status + guest contributionStatus ──────────────────
    const newStatus = action === "submit" ? "pending" : "draft";
    const newGuestStatus = action === "submit" ? "pending" : "draft";

    // ── Persist (upsert — one contribution per guest) ────────────────────
    const contribution = await db.guestContribution.upsert({
      where: { guestId: guest.id },
      create: {
        guestId: guest.id,
        weddingId: guest.weddingId,
        type: body.type,
        displayName,
        relationship,
        message: sanitizedMessage,
        favoriteSong,
        privacy,
        status: newStatus,
        wordCount,
        charCount,
        editCount: newEditCount,
        revisionHistory,
        submittedAt: action === "submit" ? now : null,
      },
      update: {
        type: body.type,
        displayName,
        relationship,
        message: sanitizedMessage,
        favoriteSong,
        privacy,
        status: newStatus,
        wordCount,
        charCount,
        editCount: newEditCount,
        revisionHistory,
        submittedAt:
          action === "submit"
            ? now
            : guest.contribution?.submittedAt ?? null,
      },
    });

    // ── Sync guest.contributionStatus ────────────────────────────────────
    await db.guest.update({
      where: { id: guest.id },
      data: { contributionStatus: newGuestStatus },
    });

    return NextResponse.json({
      success: true,
      contribution: {
        id: contribution.id,
        type: contribution.type,
        displayName: contribution.displayName,
        relationship: contribution.relationship,
        message: contribution.message,
        photoUrl: contribution.photoUrl,
        favoriteSong: contribution.favoriteSong,
        privacy: contribution.privacy,
        status: contribution.status,
        wordCount: contribution.wordCount,
        charCount: contribution.charCount,
        editCount: contribution.editCount,
        submittedAt: contribution.submittedAt
          ? contribution.submittedAt.toISOString()
          : null,
        updatedAt: contribution.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[CONTRIBUTE POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save contribution." },
      { status: 500 }
    );
  }
}
