import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-gate";
import { logAuditEvent } from "@/lib/audit";
import {
  ROYALTY_AUDIT_ACTIONS,
  MONETISATION_CATEGORIES,
  ROYALTY_RATE_BASIS_POINTS,
  DEFAULT_MINIMUM_PAYOUT_MINOR,
  formatMinor,
} from "@/lib/royalty-engine";

/* ============================================================
   /api/royalty
   ------------------------------------------------------------
   • GET  ?slug=charity-and-kudzie
       Royalty programme summary for a wedding: programme
       status, ledger totals (estimated / pending / confirmed
       / payable / paid / reversed), revenue source breakdown,
       and performance indicators (attribution counts).
       Admin-gated.

   • POST { slug, termsVersion, acceptedBy }
       Enrol a wedding in the Royalty programme. Creates the
       RoyaltyProgramme record, the first RoyaltyTermsAcceptance,
       default MonetisationPreference rows (all disabled), and
       a RoyaltyAuditEvent. Idempotent: if already enrolled,
       returns the existing programme.
       Admin-gated.
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

// ─── helpers ───────────────────────────────────────────────
async function getWeddingBySlug(slug: string) {
  return db.wedding.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true },
  });
}

async function recordRoyaltyAudit(params: {
  weddingId: string;
  action: string;
  actorId?: string;
  details?: unknown;
  ipAddress?: string;
}) {
  try {
    await db.royaltyAuditEvent.create({
      data: {
        weddingId: params.weddingId,
        action: params.action,
        actorId: params.actorId ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[ROYALTY AUDIT] failed:", params.action, err);
  }
}

// ─── GET /api/royalty ──────────────────────────────────────
export async function GET(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") ?? FLAGSHIP_SLUG;

    const wedding = await getWeddingBySlug(slug);
    if (!wedding) {
      return NextResponse.json(
        { success: false, error: `Wedding "${slug}" not found` },
        { status: 404 },
      );
    }

    // Parallel fetch: programme, ledger, attributions, revenue events
    const [programme, ledgerEntries, attributionCount, conversionCount, revenueEventCount] =
      await Promise.all([
        db.royaltyProgramme.findUnique({
          where: { weddingId: wedding.id },
          include: {
            termsAcceptances: {
              orderBy: { acceptedAt: "desc" },
              take: 5,
            },
          },
        }),
        db.royaltyLedgerEntry.findMany({
          where: { weddingId: wedding.id },
          select: {
            id: true,
            entryType: true,
            amountMinor: true,
            currency: true,
            status: true,
            reasonCode: true,
            publicDescription: true,
            createdAt: true,
            settledAt: true,
            revenueEvent: {
              select: { sourceType: true, externalReference: true },
            },
          },
        }),
        db.royaltyAttribution.count({
          where: { weddingId: wedding.id },
        }),
        db.royaltyAttribution.count({
          where: { weddingId: wedding.id, status: "converted" },
        }),
        db.qualifyingRevenueEvent.count({
          where: { weddingId: wedding.id },
        }),
      ]);

    const currency = programme?.payoutCurrency ?? "USD";

    // If not enrolled, return an empty summary shell so the UI can
    // render the enrol CTA rather than treating this as an error.
    if (!programme) {
      return NextResponse.json({
        success: true,
        enrolled: false,
        slug,
        wedding: { id: wedding.id, title: wedding.title },
        summary: {
          totalRoyalty: 0,
          estimatedRoyalty: 0,
          pendingRoyalty: 0,
          confirmedRoyalty: 0,
          payableRoyalty: 0,
          paidRoyalty: 0,
          reversedRoyalty: 0,
          currency,
        },
        sourceBreakdown: [],
        performance: {
          attributionEvents: 0,
          conversions: 0,
          revenueEvents: 0,
          conversionRate: 0,
        },
      });
    }

    // ── Tally ledger by status ───────────────────────────────
    // Reversal entries have negative amounts; we treat their absolute
    // value as part of "reversedRoyalty" so the UI can show how much
    // was rolled back.
    const totals = {
      totalRoyalty: 0,
      estimatedRoyalty: 0,
      pendingRoyalty: 0,
      confirmedRoyalty: 0,
      payableRoyalty: 0,
      paidRoyalty: 0,
      reversedRoyalty: 0,
    };

    // Source-type breakdown for the "where is the money coming from?" chart.
    const sourceMap = new Map<
      string,
      {
        sourceType: string;
        royaltyMinor: number;
        entries: number;
      }
    >();

    for (const e of ledgerEntries) {
      const signed = e.amountMinor;
      const abs = Math.abs(signed);

      // totalRoyalty = sum of non-reversed positive entries.
      if (e.status !== "reversed" && e.entryType !== "reversal") {
        totals.totalRoyalty += signed;
      }

      switch (e.status) {
        case "estimated":
          totals.estimatedRoyalty += signed;
          break;
        case "pending":
          totals.pendingRoyalty += signed;
          break;
        case "confirmed":
          totals.confirmedRoyalty += signed;
          break;
        case "payable":
        case "payout_requested":
        case "processing":
          // "Payable balance" = cleared-but-not-yet-delivered funds.
          totals.payableRoyalty += signed;
          break;
        case "paid":
          totals.paidRoyalty += signed;
          break;
        case "reversed":
          totals.reversedRoyalty += abs;
          break;
      }

      // source breakdown (skip pure reversal entries)
      if (e.entryType !== "reversal" && e.status !== "reversed") {
        const source = e.revenueEvent?.sourceType ?? "unknown";
        const cur = sourceMap.get(source) ?? {
          sourceType: source,
          royaltyMinor: 0,
          entries: 0,
        };
        cur.royaltyMinor += signed;
        cur.entries += 1;
        sourceMap.set(source, cur);
      }
    }

    // Clamp negatives to 0 in display totals (defensive).
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
      if (key === "reversedRoyalty") continue;
      if (totals[key] < 0) totals[key] = 0;
    }

    const sourceBreakdown = Array.from(sourceMap.values())
      .sort((a, b) => b.royaltyMinor - a.royaltyMinor)
      .map((s) => ({
        ...s,
        royaltyDisplay: formatMinor(s.royaltyMinor, currency),
      }));

    const conversionRate =
      attributionCount > 0
        ? Math.round((conversionCount / attributionCount) * 10000) / 100 // 2dp %
        : 0;

    return NextResponse.json({
      success: true,
      enrolled: true,
      slug,
      wedding: { id: wedding.id, title: wedding.title },
      programme: {
        id: programme.id,
        status: programme.status,
        enrolmentStatus: programme.enrolmentStatus,
        royaltyRateBasisPoints: programme.royaltyRateBasisPoints,
        termsVersion: programme.termsVersion,
        enrolledBy: programme.enrolledBy,
        enrolledAt: programme.enrolledAt?.toISOString() ?? null,
        earningStartAt: programme.earningStartAt?.toISOString() ?? null,
        earningEndAt: programme.earningEndAt?.toISOString() ?? null,
        payoutCurrency: programme.payoutCurrency,
        minimumPayoutMinor: programme.minimumPayoutMinor,
        attributionWindowDays: programme.attributionWindowDays,
        recentTermsAcceptances: programme.termsAcceptances.map((t) => ({
          id: t.id,
          termsVersion: t.termsVersion,
          acceptedBy: t.acceptedBy,
          acceptedAt: t.acceptedAt.toISOString(),
        })),
      },
      summary: {
        ...totals,
        currency,
        // Display strings for direct UI rendering
        totalRoyaltyDisplay: formatMinor(totals.totalRoyalty, currency),
        estimatedRoyaltyDisplay: formatMinor(totals.estimatedRoyalty, currency),
        pendingRoyaltyDisplay: formatMinor(totals.pendingRoyalty, currency),
        confirmedRoyaltyDisplay: formatMinor(totals.confirmedRoyalty, currency),
        payableRoyaltyDisplay: formatMinor(totals.payableRoyalty, currency),
        paidRoyaltyDisplay: formatMinor(totals.paidRoyalty, currency),
        reversedRoyaltyDisplay: formatMinor(totals.reversedRoyalty, currency),
      },
      sourceBreakdown,
      performance: {
        attributionEvents: attributionCount,
        conversions: conversionCount,
        revenueEvents: revenueEventCount,
        conversionRate,
      },
    });
  } catch (error) {
    console.error("[ROYALTY GET] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch royalty summary" },
      { status: 500 },
    );
  }
}

// ─── POST /api/royalty (enrol) ─────────────────────────────
interface EnrolPayload {
  slug?: string;
  termsVersion?: string;
  acceptedBy?: string;
  royaltyRateBasisPoints?: number;
  minimumPayoutMinor?: number;
  attributionWindowDays?: number;
  payoutCurrency?: string;
}

export async function POST(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const body = (await request.json()) as EnrolPayload;
    const slug = body.slug?.trim() || FLAGSHIP_SLUG;
    const termsVersion = body.termsVersion?.trim() || "1.0.0";
    const acceptedBy = body.acceptedBy?.trim() || "admin";
    const royaltyRateBasisPoints =
      Number.isInteger(body.royaltyRateBasisPoints) &&
      body.royaltyRateBasisPoints! >= 0 &&
      body.royaltyRateBasisPoints! <= 10000
        ? body.royaltyRateBasisPoints!
        : ROYALTY_RATE_BASIS_POINTS;
    const minimumPayoutMinor =
      Number.isInteger(body.minimumPayoutMinor) && body.minimumPayoutMinor! >= 0
        ? body.minimumPayoutMinor!
        : DEFAULT_MINIMUM_PAYOUT_MINOR;
    const attributionWindowDays =
      Number.isInteger(body.attributionWindowDays) && body.attributionWindowDays! > 0
        ? body.attributionWindowDays!
        : 30;
    const payoutCurrency = body.payoutCurrency?.trim() || "USD";

    const wedding = await getWeddingBySlug(slug);
    if (!wedding) {
      return NextResponse.json(
        { success: false, error: `Wedding "${slug}" not found` },
        { status: 404 },
      );
    }

    // Idempotency: if already enrolled, return existing programme.
    const existing = await db.royaltyProgramme.findUnique({
      where: { weddingId: wedding.id },
    });
    if (existing && existing.status === "enrolled") {
      return NextResponse.json({
        success: true,
        alreadyEnrolled: true,
        programme: {
          id: existing.id,
          weddingId: existing.weddingId,
          status: existing.status,
          enrolmentStatus: existing.enrolmentStatus,
          royaltyRateBasisPoints: existing.royaltyRateBasisPoints,
          termsVersion: existing.termsVersion,
          enrolledAt: existing.enrolledAt?.toISOString() ?? null,
        },
      });
    }

    // Atomic enrolment: programme + terms acceptance + default preferences + audit
    const programme = await db.$transaction(async (tx) => {
      // Upsert handles the case where a previous not_enrolled record exists.
      const prog = await tx.royaltyProgramme.upsert({
        where: { weddingId: wedding.id },
        create: {
          weddingId: wedding.id,
          status: "enrolled",
          enrolmentStatus: "active",
          royaltyRateBasisPoints,
          termsVersion,
          enrolledBy: acceptedBy,
          enrolledAt: new Date(),
          earningStartAt: new Date(),
          payoutCurrency,
          minimumPayoutMinor,
          attributionWindowDays,
        },
        update: {
          status: "enrolled",
          enrolmentStatus: "active",
          royaltyRateBasisPoints,
          termsVersion,
          enrolledBy: acceptedBy,
          enrolledAt: new Date(),
          earningStartAt: new Date(),
          payoutCurrency,
          minimumPayoutMinor,
          attributionWindowDays,
          disabledBy: null,
          disabledAt: null,
        },
      });

      // Record terms acceptance (append-only history)
      await tx.royaltyTermsAcceptance.create({
        data: {
          programmeId: prog.id,
          termsVersion,
          acceptedBy,
          acceptedAt: new Date(),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
          userAgent: request.headers.get("user-agent") ?? null,
        },
      });

      // Seed default monetisation preferences — every category disabled
      // (couples must explicitly opt in to each channel).
      // Upsert to support re-enrolment without duplicate-key errors.
      for (const category of MONETISATION_CATEGORIES) {
        await tx.monetisationPreference.upsert({
          where: {
            weddingId_category: { weddingId: wedding.id, category },
          },
          create: {
            weddingId: wedding.id,
            category,
            enabled: false,
            placementRules: null,
          },
          update: {}, // leave existing preferences untouched on re-enrol
        });
      }

      // Royalty-specific audit
      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: wedding.id,
          action: ROYALTY_AUDIT_ACTIONS.ENROL,
          actorId: acceptedBy,
          details: JSON.stringify({
            termsVersion,
            royaltyRateBasisPoints,
            minimumPayoutMinor,
            attributionWindowDays,
            payoutCurrency,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return prog;
    });

    // General audit log (platform-wide trail)
    await logAuditEvent({
      action: "royalty.enrol",
      resourceType: "RoyaltyProgramme",
      resourceId: programme.id,
      afterValue: {
        slug,
        termsVersion,
        royaltyRateBasisPoints,
        acceptedBy,
      },
      weddingId: wedding.id,
      actorId: acceptedBy,
    });

    return NextResponse.json(
      {
        success: true,
        programme: {
          id: programme.id,
          weddingId: programme.weddingId,
          status: programme.status,
          enrolmentStatus: programme.enrolmentStatus,
          royaltyRateBasisPoints: programme.royaltyRateBasisPoints,
          termsVersion: programme.termsVersion,
          enrolledAt: programme.enrolledAt?.toISOString() ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[ROYALTY POST] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to enrol wedding in royalty programme" },
      { status: 500 },
    );
  }
}
