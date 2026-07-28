import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-gate";
import { logAuditEvent } from "@/lib/audit";
import {
  ROYALTY_AUDIT_ACTIONS,
  ROYALTY_RATE_BASIS_POINTS,
  calculateQualifyingRevenue,
  calculateRoyalty,
  isEligibleSourceType,
  isExcludedRevenueType,
  type Deduction,
} from "@/lib/royalty-engine";

/* ============================================================
   /api/royalty/revenue-event
   ------------------------------------------------------------
   • POST — internal endpoint for recording a qualifying
     revenue event and accruing its royalty ledger entry.

   This endpoint is ADMIN-GATED and intended for back-office
   ingestion (manual entry, batch import, internal connectors).
   For partner-driven conversions, use /api/royalty/webhook
   (which is authenticated by idempotency key + partner ID).

   Body:
     {
       slug: string,                        // wedding slug
       sourceType: string,                  // merchandise | travel | ...
       partnerId?: string,
       externalReference?: string,
       grossPlatformRevenueMinor: number,   // integer cents
       deductions?: Deduction[],            // [{type,amountMinor,reason}]
       currency?: string,                   // default USD
       attributionId?: string,
       idempotencyKey: string,              // REQUIRED
       publicDescription?: string,
       internalNotes?: string,
       collectedAt?: string                 // ISO date
     }

   Flow:
     1. Validate body & idempotencyKey (reject duplicates).
     2. Resolve wedding by slug; ensure programme is enrolled.
     3. Compute qualifyingNetRevenue & royaltyAmount
        using INTEGER math only.
     4. Transactionally create:
        - QualifyingRevenueEvent (status="pending")
        - RoyaltyLedgerEntry (entryType="accrual",
            status="pending", amountMinor=royaltyAmount)
        - RoyaltyAuditEvent
     5. Return both records.

   Idempotency: if the idempotencyKey already exists, return
   the original records with `duplicate: true` (HTTP 200).
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

interface RevenueEventPayload {
  slug?: string;
  sourceType?: string;
  partnerId?: string;
  externalReference?: string;
  grossPlatformRevenueMinor?: number;
  deductions?: Deduction[];
  currency?: string;
  attributionId?: string;
  idempotencyKey?: string;
  publicDescription?: string;
  internalNotes?: string;
  collectedAt?: string;
}

export async function POST(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const body = (await request.json()) as RevenueEventPayload;

    // ── Validate required fields ────────────────────────────
    const slug = body.slug?.trim() || FLAGSHIP_SLUG;
    const sourceType = body.sourceType?.trim();
    const idempotencyKey = body.idempotencyKey?.trim();
    const grossPlatformRevenueMinor = body.grossPlatformRevenueMinor;

    if (!sourceType) {
      return NextResponse.json(
        { success: false, error: "sourceType is required" },
        { status: 400 },
      );
    }
    if (!idempotencyKey) {
      return NextResponse.json(
        { success: false, error: "idempotencyKey is required" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(grossPlatformRevenueMinor) || grossPlatformRevenueMinor! < 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "grossPlatformRevenueMinor must be a non-negative integer (cents)",
        },
        { status: 400 },
      );
    }
    if (!isEligibleSourceType(sourceType)) {
      return NextResponse.json(
        {
          success: false,
          error: `sourceType "${sourceType}" is not eligible for royalty. Eligible: merchandise, travel, vendor, venue, referral, advertising, clothing`,
        },
        { status: 400 },
      );
    }

    // ── Validate deductions ─────────────────────────────────
    const deductions = body.deductions ?? [];
    for (const d of deductions) {
      if (!d.type || !d.reason) {
        return NextResponse.json(
          { success: false, error: "Each deduction needs { type, amountMinor, reason }" },
          { status: 400 },
        );
      }
      if (!Number.isInteger(d.amountMinor) || d.amountMinor < 0) {
        return NextResponse.json(
          { success: false, error: `deduction.amountMinor must be a non-negative integer (type=${d.type})` },
          { status: 400 },
        );
      }
      if (isExcludedRevenueType(d.type)) {
        // Sanity: excluded revenue types should never be deductions either.
        return NextResponse.json(
          { success: false, error: `deduction type "${d.type}" is reserved for excluded revenue` },
          { status: 400 },
        );
      }
    }

    // ── Resolve wedding ─────────────────────────────────────
    const wedding = await db.wedding.findUnique({
      where: { slug },
      select: { id: true, slug: true, title: true },
    });
    if (!wedding) {
      return NextResponse.json(
        { success: false, error: `Wedding "${slug}" not found` },
        { status: 404 },
      );
    }

    // ── Resolve programme (must be enrolled) ────────────────
    const programme = await db.royaltyProgramme.findUnique({
      where: { weddingId: wedding.id },
    });
    if (!programme || programme.status !== "enrolled" || programme.enrolmentStatus !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: `Wedding "${slug}" is not enrolled in the royalty programme (or programme is inactive)`,
        },
        { status: 409 },
      );
    }

    // ── Idempotency check ───────────────────────────────────
    // Look for an existing revenue event with this idempotencyKey.
    // We also defensively check the ledger entry in case the event
    // was created but the ledger write failed mid-transaction.
    const existingEvent = await db.qualifyingRevenueEvent.findUnique({
      where: { idempotencyKey },
      include: { ledgerEntries: { take: 1 } },
    });
    if (existingEvent) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Revenue event with this idempotencyKey already exists",
        revenueEvent: {
          id: existingEvent.id,
          status: existingEvent.status,
          qualifyingNetRevenueMinor: existingEvent.qualifyingNetRevenueMinor,
        },
        ledgerEntry: existingEvent.ledgerEntries[0]
          ? {
              id: existingEvent.ledgerEntries[0].id,
              status: existingEvent.ledgerEntries[0].status,
              amountMinor: existingEvent.ledgerEntries[0].amountMinor,
            }
          : null,
      });
    }

    // ── Calculate money (integer math) ──────────────────────
    const { qualifyingNetRevenueMinor, totalDeductionsMinor } =
      calculateQualifyingRevenue(grossPlatformRevenueMinor!, deductions);

    const basisPoints = programme.royaltyRateBasisPoints ?? ROYALTY_RATE_BASIS_POINTS;
    const royaltyAmountMinor = calculateRoyalty(qualifyingNetRevenueMinor, basisPoints);

    const currency = body.currency?.trim() || programme.payoutCurrency || "USD";

    // Resolve attribution if provided
    let attributionId: string | null = null;
    if (body.attributionId) {
      const attr = await db.royaltyAttribution.findUnique({
        where: { id: body.attributionId },
        select: { id: true, weddingId: true, status: true, expiresAt: true },
      });
      if (!attr) {
        return NextResponse.json(
          { success: false, error: `Attribution "${body.attributionId}" not found` },
          { status: 404 },
        );
      }
      if (attr.weddingId !== wedding.id) {
        return NextResponse.json(
          { success: false, error: "Attribution does not belong to this wedding" },
          { status: 403 },
        );
      }
      if (attr.status === "expired" || attr.status === "fraud") {
        return NextResponse.json(
          { success: false, error: `Attribution status "${attr.status}" cannot convert` },
          { status: 409 },
        );
      }
      if (attr.expiresAt && attr.expiresAt.getTime() < Date.now()) {
        return NextResponse.json(
          { success: false, error: "Attribution window has expired" },
          { status: 409 },
        );
      }
      attributionId = attr.id;
    }

    const collectedAt = body.collectedAt
      ? new Date(body.collectedAt)
      : new Date();
    if (Number.isNaN(collectedAt.getTime())) {
      return NextResponse.json(
        { success: false, error: "collectedAt is not a valid ISO date" },
        { status: 400 },
      );
    }

    // Confirmation due date — programme-configurable; default 30 days
    const confirmationDueAt = new Date(collectedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const publicDescription =
      body.publicDescription?.trim() ||
      `Royalty accrual from ${sourceType} revenue`;

    // ── Atomic creation: event + ledger entry + audit ───────
    const result = await db.$transaction(async (tx) => {
      const revenueEvent = await tx.qualifyingRevenueEvent.create({
        data: {
          weddingId: wedding.id,
          attributionId,
          sourceType,
          partnerId: body.partnerId?.trim() || null,
          externalReference: body.externalReference?.trim() || null,
          grossPlatformRevenueMinor: grossPlatformRevenueMinor!,
          deductionsMinor: totalDeductionsMinor,
          qualifyingNetRevenueMinor,
          currency,
          collectedAt,
          confirmationDueAt,
          status: "pending",
          idempotencyKey,
          metadata: JSON.stringify({
            deductions,
            publicDescription,
            internalNotes: body.internalNotes ?? null,
            createdBy: "admin",
            source: "api",
          }),
        },
      });

      const ledgerEntry = await tx.royaltyLedgerEntry.create({
        data: {
          weddingId: wedding.id,
          revenueEventId: revenueEvent.id,
          entryType: "accrual",
          amountMinor: royaltyAmountMinor,
          currency,
          royaltyRateBasisPoints: basisPoints,
          status: "pending",
          publicDescription,
          internalNotes: body.internalNotes?.trim() || null,
          createdBy: "admin",
        },
      });

      // Mark attribution as converted if linked
      if (attributionId) {
        await tx.royaltyAttribution.update({
          where: { id: attributionId },
          data: {
            status: "converted",
            conversionId: revenueEvent.id,
            lastTouchAt: new Date(),
          },
        });
      }

      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: wedding.id,
          action: ROYALTY_AUDIT_ACTIONS.REVENUE_ESTIMATE,
          actorId: "admin",
          details: JSON.stringify({
            revenueEventId: revenueEvent.id,
            ledgerEntryId: ledgerEntry.id,
            sourceType,
            partnerId: body.partnerId ?? null,
            externalReference: body.externalReference ?? null,
            grossPlatformRevenueMinor: grossPlatformRevenueMinor,
            deductionsMinor: totalDeductionsMinor,
            qualifyingNetRevenueMinor,
            royaltyAmountMinor,
            basisPoints,
            idempotencyKey,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return { revenueEvent, ledgerEntry };
    });

    // General audit
    await logAuditEvent({
      action: "royalty.revenue_event.create",
      resourceType: "QualifyingRevenueEvent",
      resourceId: result.revenueEvent.id,
      weddingId: wedding.id,
      afterValue: {
        slug,
        sourceType,
        grossPlatformRevenueMinor,
        qualifyingNetRevenueMinor,
        royaltyAmountMinor,
        ledgerEntryId: result.ledgerEntry.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        revenueEvent: {
          id: result.revenueEvent.id,
          weddingId: result.revenueEvent.weddingId,
          attributionId: result.revenueEvent.attributionId,
          sourceType: result.revenueEvent.sourceType,
          partnerId: result.revenueEvent.partnerId,
          externalReference: result.revenueEvent.externalReference,
          grossPlatformRevenueMinor: result.revenueEvent.grossPlatformRevenueMinor,
          deductionsMinor: result.revenueEvent.deductionsMinor,
          qualifyingNetRevenueMinor: result.revenueEvent.qualifyingNetRevenueMinor,
          currency: result.revenueEvent.currency,
          collectedAt: result.revenueEvent.collectedAt.toISOString(),
          confirmationDueAt: result.revenueEvent.confirmationDueAt?.toISOString() ?? null,
          status: result.revenueEvent.status,
          idempotencyKey: result.revenueEvent.idempotencyKey,
          createdAt: result.revenueEvent.createdAt.toISOString(),
        },
        ledgerEntry: {
          id: result.ledgerEntry.id,
          weddingId: result.ledgerEntry.weddingId,
          revenueEventId: result.ledgerEntry.revenueEventId,
          entryType: result.ledgerEntry.entryType,
          amountMinor: result.ledgerEntry.amountMinor,
          currency: result.ledgerEntry.currency,
          royaltyRateBasisPoints: result.ledgerEntry.royaltyRateBasisPoints,
          status: result.ledgerEntry.status,
          publicDescription: result.ledgerEntry.publicDescription,
          internalNotes: result.ledgerEntry.internalNotes,
          createdAt: result.ledgerEntry.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[ROYALTY REVENUE-EVENT POST] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create revenue event" },
      { status: 500 },
    );
  }
}
