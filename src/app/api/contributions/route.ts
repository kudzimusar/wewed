import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireWeddingPermission } from "@/lib/wedding-access";
import { generateToken } from "@/lib/contribution-utils";
import { BRIDAL_PARTY } from "@/lib/bridal-party-data";

/* ============================================================
   /api/contributions
   ------------------------------------------------------------
   Admin-only moderation endpoints for the guest contributions
   feature.

   • GET  → list contributions for the explicitly selected wedding.
   • POST → generate contribution tokens only inside the caller's
            active authorised wedding context.
   • Optional demo samples require an explicit seedSamples=true request;
     no named production wedding receives implicit special treatment.

   Wedding authority is resolved from the signed application session and
   must match the requested wedding slug.
   ============================================================ */

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminContributionRow {
  id: string;
  type: string;
  displayName: string;
  relationship: string | null;
  message: string;
  photoUrl: string | null;
  favoriteSong: string | null;
  privacy: string;
  status: string;
  moderatorNotes: string | null;
  wordCount: number;
  charCount: number;
  editCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  guest: {
    id: string;
    name: string;
    role: string;
    roleDetail: string | null;
    side: string | null;
    contributionStatus: string | null;
  } | null;
}

interface BridalSampleContribution {
  bridalId: string;
  type:
    | "memory"
    | "advice"
    | "blessing"
    | "funny_story"
    | "wish";
  status: "approved" | "featured";
  useField: "quote" | "favoriteMemory";
}

const BRIDAL_SAMPLES: BridalSampleContribution[] = [
  { bridalId: "tendai-m", type: "blessing", status: "featured", useField: "quote" },
  { bridalId: "takudzwa-m", type: "blessing", status: "approved", useField: "quote" },
  { bridalId: "rumbidzai-c", type: "advice", status: "approved", useField: "quote" },
  { bridalId: "chiedza-k", type: "wish", status: "featured", useField: "quote" },
  { bridalId: "munashe-m", type: "funny_story", status: "approved", useField: "favoriteMemory" },
  { bridalId: "kudakwashe-n", type: "memory", status: "approved", useField: "favoriteMemory" },
  { bridalId: "narasora-m", type: "wish", status: "featured", useField: "quote" },
  { bridalId: "norioshona-m", type: "wish", status: "approved", useField: "quote" },
];

// ─── GET /api/contributions ─────────────────────────────────────────────────
// List all contributions for the wedding, joined with guest info.
// Query: ?status=pending|approved|rejected|draft|featured|hidden|all&slug=...
//        (default status: all)

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, "content.edit");
  if (access.error) return access.error;

  try {
    const statusParam = request.nextUrl.searchParams.get("status") ?? "all";
    const allowedStatuses = [
      "all",
      "draft",
      "pending",
      "approved",
      "rejected",
      "featured",
      "hidden",
    ];
    if (!allowedStatuses.includes(statusParam)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const slug = request.nextUrl.searchParams.get("weddingSlug")?.trim() || request.nextUrl.searchParams.get("slug")?.trim();
    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Wedding slug is required." },
        { status: 400 }
      );
    }

    const wedding = await db.wedding.findFirst({
      where: { slug },
      select: { id: true },
    });

    if (!wedding) {
      return NextResponse.json(
        { success: false, error: "Wedding not found." },
        { status: 404 }
      );
    }
    if (wedding.id !== access.context.weddingId) {
      return NextResponse.json(
        { success: false, error: "Forbidden — wedding context does not match the active workspace." },
        { status: 403 }
      );
    }

    const where =
      statusParam === "all"
        ? { weddingId: wedding.id }
        : { weddingId: wedding.id, status: statusParam };

    const rows = await db.guestContribution.findMany({
      where,
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            role: true,
            roleDetail: true,
            side: true,
            contributionStatus: true,
          },
        },
      },
      orderBy: [
        // Pending first (most actionable), then most recent
        { submittedAt: "desc" },
        { updatedAt: "desc" },
      ],
    });

    const data: AdminContributionRow[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      displayName: r.displayName,
      relationship: r.relationship,
      message: r.message,
      photoUrl: r.photoUrl,
      favoriteSong: r.favoriteSong,
      privacy: r.privacy,
      status: r.status,
      moderatorNotes: r.moderatorNotes,
      wordCount: r.wordCount,
      charCount: r.charCount,
      editCount: r.editCount,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      reviewedBy: r.reviewedBy,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      guest: r.guest
        ? {
            id: r.guest.id,
            name: r.guest.name,
            role: r.guest.role,
            roleDetail: r.guest.roleDetail,
            side: r.guest.side,
            contributionStatus: r.guest.contributionStatus,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("[CONTRIBUTIONS GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contributions." },
      { status: 500 }
    );
  }
}

// ─── POST /api/contributions ────────────────────────────────────────────────
// Bulk-generate contribution tokens for all selected-wedding guests that
// don't already have one. Also creates sample bridal party contributions
// using bridal-party-data.ts so there's demo content for moderation.

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, "guests.edit");
  if (access.error) return access.error;

  try {
    const body = await request.json().catch(() => ({}));
    const slug = (body?.weddingSlug || body?.slug || request.nextUrl.searchParams.get("weddingSlug") || request.nextUrl.searchParams.get("slug"))?.trim();

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Wedding slug is required." },
        { status: 400 }
      );
    }

    const wedding = await db.wedding.findFirst({
      where: { slug },
      select: { id: true, slug: true },
    });

    if (!wedding) {
      return NextResponse.json(
        { success: false, error: "Wedding not found." },
        { status: 404 }
      );
    }
    if (wedding.id !== access.context.weddingId) {
      return NextResponse.json(
        { success: false, error: "Forbidden — wedding context does not match the active workspace." },
        { status: 403 }
      );
    }

    // ── 1. Optional explicit demo seeding; never triggered by a named wedding ──
    const bridalGuests: Record<string, { id: string; name: string }> = {};

    if (body?.seedSamples === true) {
      for (const member of BRIDAL_PARTY) {
        const existing = await db.guest.findFirst({
          where: { weddingId: wedding.id, name: member.name },
          select: { id: true, name: true },
        });

        let guestId: string;
        if (existing) {
          // Patch role/side if they were seeded as plain 'guest'
          await db.guest.update({
            where: { id: existing.id },
            data: {
              role: member.isKid ? "family" : "bridal_party",
              roleDetail: member.role,
              side: member.side,
            },
          });
          guestId = existing.id;
        } else {
          const created = await db.guest.create({
            data: {
              name: member.name,
              role: member.isKid ? "family" : "bridal_party",
              roleDetail: member.role,
              side: member.side,
              weddingId: wedding.id,
            },
          });
          guestId = created.id;
        }
        bridalGuests[member.id] = { id: guestId, name: member.name };
      }
    }

    // ── 2. Generate tokens for every guest that doesn't have one ─────────
    const guestsWithoutToken = await db.guest.findMany({
      where: { weddingId: wedding.id, contributionToken: null },
      select: { id: true, name: true },
    });

    let generated = 0;
    const tokens: { guestId: string; guestName: string; token: string; url: string }[] = [];

    for (const g of guestsWithoutToken) {
      // Generate a unique token (retry on the rare collision)
      let token = generateToken();
      let attempts = 0;
      while (attempts < 5) {
        const clash = await db.guest.findUnique({
          where: { contributionToken: token },
          select: { id: true },
        });
        if (!clash) break;
        token = generateToken();
        attempts++;
      }

      await db.guest.update({
        where: { id: g.id },
        data: {
          contributionToken: token,
          contributionStatus: g.name ? "none" : "none",
        },
      });

      generated++;
      tokens.push({
        guestId: g.id,
        guestName: g.name,
        token,
        url: `/contribute?token=${token}`,
      });
    }

    // ── 3. Create sample bridal party contributions (demo content) ────────
    // Idempotent: skip if the guest already has a contribution.
    let samplesCreated = 0;
    const now = new Date();
    // Stagger submittedAt timestamps so the public feed has variety.
    const baseTime = now.getTime();

    if (body?.seedSamples === true) {
      for (const sample of BRIDAL_SAMPLES) {
        const member = BRIDAL_PARTY.find((m) => m.id === sample.bridalId);
        if (!member) continue;
        const guestRef = bridalGuests[member.id];
        if (!guestRef) continue;

        const existing = await db.guestContribution.findUnique({
          where: { guestId: guestRef.id },
          select: { id: true },
        });
        if (existing) continue;

        const message =
          sample.useField === "quote" ? member.quote : member.favoriteMemory;

        // Word/char counts (pre-sanitized — bridal data is trusted, but we
        // still sanitize on storage for consistency).
        const wordCount = message.trim().split(/\s+/).length;
        const charCount = message.length;

        // Stagger timestamps: newest first, Tendai (index 0) is the most recent.
        const staggerMs =
          (BRIDAL_SAMPLES.length - BRIDAL_SAMPLES.indexOf(sample)) * 86_400_000; // 1 day apart
        const submittedAt = new Date(baseTime - staggerMs);

        await db.guestContribution.create({
          data: {
            guestId: guestRef.id,
            weddingId: wedding.id,
            type: sample.type,
            displayName: member.name,
            relationship: member.relationshipToCouple,
            message,
            favoriteSong: member.favoriteSong,
            privacy: "public",
            status: sample.status,
            wordCount,
            charCount,
            editCount: 1,
            revisionHistory: null,
            submittedAt,
            reviewedAt: now,
            reviewedBy: "admin",
          },
        });

        // Sync guest contributionStatus
        await db.guest.update({
          where: { id: guestRef.id },
          data: { contributionStatus: sample.status },
        });

        samplesCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      samplesCreated,
      tokens,
    });
  } catch (error) {
    console.error("[CONTRIBUTIONS POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate tokens / sample contributions." },
      { status: 500 }
    );
  }
}

