import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import {
  ROYALTY_RATE_BASIS_POINTS,
  ROYALTY_AUDIT_ACTIONS,
  calculateQualifyingRevenue,
  calculateRoyalty,
  isEligibleSourceType,
  getAttributionWindowDays,
  type Deduction,
} from "@/lib/royalty-engine";

/* ============================================================
   /api/royalty/webhook
   ------------------------------------------------------------
   • POST — partner conversion webhook.

   Receives a partner-reported conversion (e.g.Booking.com
   confirms a hotel booking attributed to a wedding's travel
   page, or a merch partner confirms a sale).

   Authentication:
     This endpoint is NOT admin-gated. Instead it is
     authenticated by:
       1. The presence of a valid `partnerId` matching a
          registered partner record (TODO: future task — for
          MVP we accept any non-empty partnerId).
       2. The `idempotencyKey` — duplicate keys are rejected
          (idempotent processing).

   Body:
     {
       weddingSlug: string,
       sourceType: string,
       partnerId: string,
       externalReference: string,
       grossAmountMinor: number,
       currency?: string,
       idempotencyKey: string,
       deductions?: Deduction[],
       attributionId?: string,
       campaignId?: string,
       referralCode?: string,
       anonymousSessionRef?: string
     }

   Flow:
     1. Validate body & idempotencyKey.
     2. Look up wedding by slug; ensure programme is active.
     3. Check for an existing attribution (by referralCode or
        campaignId) — create one if none exists.
     4. Calculate qualifyingNetRevenue & royaltyAmount.
     5. Transactionally create:
        - QualifyingRevenueEvent (status="pending")
        - RoyaltyLedgerEntry (entryType="accrual",
            status="pending")
        - Mark attribution as "converted" if linked
        - RoyaltyAuditEvent
     6. Return { success, royaltyAmountMinor }.

   Idempotency: if the idempotencyKey already exists, return
   the original result (HTTP 200, duplicate=true) without
   creating new records.
   ============================================================ */

interface WebhookPayload {
  weddingSlug?: string;
  sourceType?: string;
  partnerId?: string;
  externalReference?: string;
  grossAmountMinor?: number;
  currency?: string;
  idempotencyKey?: string;
  deductions?: Deduction[];
  attributionId?: string;
  campaignId?: string;
  referralCode?: string;
  anonymousSessionRef?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WebhookPayload;

    // ── Validate required fields ────────────────────────────
    const weddingSlug = body.weddingSlug?.trim();
    const sourceType = body.sourceType?.trim();
    const partnerId = body.partnerId?.trim();
    const externalReference = body.externalReference?.trim();
    const grossAmountMinor = body.grossAmountMinor;
    const idempotencyKey = body.idempotencyKey?.trim();

    if (!weddingSlug) {
      return NextResponse.json(
        { success: false, error: "weddingSlug is required" },
        { status: 400 },
      );
    }
    if (!sourceType) {
      return NextResponse.json(
        { success: false, error: "sourceType is required" },
        { status: 400 },
      );
    }
    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: "partnerId is required" },
        { status: 400 },
      );
    }
    if (!idempotencyKey) {
      return NextResponse.json(
        { success: false, error: "idempotencyKey is required" },
        { status: 400 },
      );
    }
    if (!externalReference) {
      return NextResponse.json(
        { success: false, error: "externalReference is required" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(grossAmountMinor) || grossAmountMinor! < 0) {
      return NextResponse.json(
        {
          success: false,
          error: "grossAmountMinor must be a non-negative integer (cents)",
        },
        { status: 400 },
      );
    }
    if (!isEligibleSourceType(sourceType)) {
      return NextResponse.json(
        {
          success: false,
          error: `sourceType "${sourceType}" is not eligible for royalty`,
        },
        { status: 400 },
      );
    }

    // Validate deductions
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
          {
            success: false,
            error: `deduction.amountMinor must be a non-negative integer (type=${d.type})`,
          },
          { status: 400 },
        );
      }
    }

    // ── Idempotency check (early-exit) ─────────────────────
    // We treat idempotencyKey as globally unique across all
    // revenue events (it has a unique constraint in the schema).
    const existingEvent = await db.qualifyingRevenueEvent.findUnique({
      where: { idempotencyKey },
      include: { ledgerEntries: { take: 1 } },
    });
    if (existingEvent) {
      // Re-return the original result so the partner can record
      // the royalty amount for their reconciliation.
      const royaltyAmountMinor = existingEvent.ledgerEntries[0]?.amountMinor ?? 0;
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Webhook already processed for this idempotencyKey",
        revenueEventId: existingEvent.id,
        royaltyAmountMinor,
      });
    }

    // ── Resolve wedding & programme ────────────────────────
    const wedding = await db.wedding.findUnique({
      where: { slug: weddingSlug },
      select: { id: true, slug: true, title: true },
    });
    if (!wedding) {
      return NextResponse.json(
        { success: false, error: `Wedding "${weddingSlug}" not found` },
        { status: 404 },
      );
    }

    const programme = await db.royaltyProgramme.findUnique({
      where: { weddingId: wedding.id },
    });
    if (!programme || programme.enrolmentStatus !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: `Wedding "${weddingSlug}" is not enrolled in the royalty programme (or programme is inactive)`,
        },
        { status: 409 },
      );
    }

    // ── Resolve or create attribution ──────────────────────
    // Look for an existing active attribution by referralCode,
    // campaignId, or an explicit attributionId.
    let attributionId: string | null = null;
    if (body.attributionId) {
      const attr = await db.royaltyAttribution.findUnique({
        where: { id: body.attributionId },
      });
      if (attr && attr.weddingId === wedding.id) {
        attributionId = attr.id;
      }
    } else if (body.referralCode) {
      const attr = await db.royaltyAttribution.findFirst({
        where: {
          weddingId: wedding.id,
          referralCode: body.referralCode,
          status: "active",
        },
        orderBy: { createdAt: "desc" },
      });
      if (attr) attributionId = attr.id;
    } else if (body.campaignId) {
      const attr = await db.royaltyAttribution.findFirst({
        where: {
          weddingId: wedding.id,
          campaignId: body.campaignId,
          status: "active",
        },
        orderBy: { createdAt: "desc" },
      });
      if (attr) attributionId = attr.id;
    }

    // If no attribution exists, create one with a default
    // attribution window based on the source type. This lets
    // partners fire conversions even without a prior click event.
    if (!attributionId) {
      const windowDays = getAttributionWindowDays(sourceType);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

      const newAttr = await db.royaltyAttribution.create({
        data: {
          weddingId: wedding.id,
          sourceType,
          partnerId,
          campaignId: body.campaignId ?? null,
          anonymousSessionRef: body.anonymousSessionRef ?? null,
          referralCode: body.referralCode ?? null,
          firstTouchAt: now,
          lastTouchAt: now,
          expiresAt,
          attributionModel: "last_touch",
          status: "active",
          idempotencyKey: `webhook-${idempotencyKey}`, // dedupe attribution creation
          fraudState: "clean",
          metadata: JSON.stringify({
            createdFrom: "webhook",
            partnerId,
            externalReference,
          }),
        },
      });
      attributionId = newAttr.id;
    }

    // ── Calculate royalty ──────────────────────────────────
    const { qualifyingNetRevenueMinor, totalDeductionsMinor } =
      calculateQualifyingRevenue(grossAmountMinor!, deductions);

    const basisPoints = programme.royaltyRateBasisPoints ?? ROYALTY_RATE_BASIS_POINTS;
    const royaltyAmountMinor = calculateRoyalty(qualifyingNetRevenueMinor, basisPoints);

    const currency = body.currency?.trim().toUpperCase() || programme.payoutCurrency || "USD";

    const publicDescription = `Royalty from ${sourceType} conversion (partner: ${partnerId})`;

    const collectedAt = new Date();
    const confirmationDueAt = new Date(
      collectedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    // ── Atomic creation: event + ledger + audit ────────────
    const result = await db.$transaction(async (tx) => {
      const revenueEvent = await tx.qualifyingRevenueEvent.create({
        data: {
          weddingId: wedding.id,
          attributionId,
          sourceType,
          partnerId,
          externalReference,
          grossPlatformRevenueMinor: grossAmountMinor!,
          deductionsMinor: totalDeductionsMinor,
          qualifyingNetRevenueMinor,
          currency,
          collectedAt,
          confirmationDueAt,
          status: "pending",
          idempotencyKey,
          metadata: JSON.stringify({
            source: "webhook",
            partnerId,
            deductions,
            campaignId: body.campaignId ?? null,
            referralCode: body.referralCode ?? null,
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
          internalNotes: `Webhook conversion (partner: ${partnerId}, ref: ${externalReference})`,
          createdBy: `partner:${partnerId}`,
        },
      });

      // Mark attribution as converted
      await tx.royaltyAttribution.update({
        where: { id: attributionId! },
        data: {
          status: "converted",
          conversionId: revenueEvent.id,
          lastTouchAt: collectedAt,
        },
      });

      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: wedding.id,
          action: ROYALTY_AUDIT_ACTIONS.WEBHOOK_RECEIVE,
          actorId: `partner:${partnerId}`,
          details: JSON.stringify({
            revenueEventId: revenueEvent.id,
            ledgerEntryId: ledgerEntry.id,
            sourceType,
            partnerId,
            externalReference,
            grossAmountMinor,
            deductionsMinor: totalDeductionsMinor,
            qualifyingNetRevenueMinor,
            royaltyAmountMinor,
            basisPoints,
            idempotencyKey,
            attributionId,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return { revenueEvent, ledgerEntry };
    });

    await logAuditEvent({
      action: "royalty.webhook.conversion",
      resourceType: "QualifyingRevenueEvent",
      resourceId: result.revenueEvent.id,
      weddingId: wedding.id,
      afterValue: {
        slug: weddingSlug,
        sourceType,
        partnerId,
        externalReference,
        grossAmountMinor,
        qualifyingNetRevenueMinor,
        royaltyAmountMinor,
      },
    });

    return NextResponse.json(
      {
        success: true,
        revenueEventId: result.revenueEvent.id,
        ledgerEntryId: result.ledgerEntry.id,
        royaltyAmountMinor,
        qualifyingNetRevenueMinor,
        currency,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[ROYALTY WEBHOOK POST] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}
