import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-gate";
import { logAuditEvent } from "@/lib/audit";
import {
  ROYALTY_AUDIT_ACTIONS,
  LEDGER_STATUSES,
  isValidTransition,
  isSettledStatus,
} from "@/lib/royalty-engine";

/* ============================================================
   /api/royalty/ledger/[id]
   ------------------------------------------------------------
   • PATCH  { status, reasonCode?, internalNotes? }
       Update a ledger entry's status. Validates the state
       transition via isValidTransition. Appends audit trail.
       Admin-gated.

   • POST   /reverse
       Body: { reasonCode, internalNotes }
       Reverse a ledger entry. Creates a compensating reversal
       entry (entryType="reversal", amountMinor = -original),
       marks the original entry status="reversed", and audits.
       Admin-gated.

   Append-only invariant:
     • We never edit a confirmed/paid ledger entry's amount.
     • Corrections are made via the /reverse endpoint, which
       creates a compensating reversal entry.
     • The PATCH endpoint only changes status (and audit-only
       fields: reasonCode, internalNotes).
   ============================================================ */

interface LedgerPatchPayload {
  status?: string;
  reasonCode?: string;
  internalNotes?: string;
  actorId?: string;
}

interface ReversePayload {
  reasonCode?: string;
  internalNotes?: string;
  actorId?: string;
}

// ─── PATCH /api/royalty/ledger/[id] ────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  const { id } = await params;

  try {
    const body = (await request.json()) as LedgerPatchPayload;
    const newStatus = body.status?.trim();
    const reasonCode = body.reasonCode?.trim() || null;
    const internalNotes = body.internalNotes?.trim() || null;
    const actorId = body.actorId?.trim() || "admin";

    if (!newStatus) {
      return NextResponse.json(
        { success: false, error: "status is required" },
        { status: 400 },
      );
    }
    if (!(LEDGER_STATUSES as readonly string[]).includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status: ${newStatus}` },
        { status: 400 },
      );
    }

    // Fetch the current entry
    const entry = await db.royaltyLedgerEntry.findUnique({
      where: { id },
      select: {
        id: true,
        weddingId: true,
        status: true,
        amountMinor: true,
        currency: true,
        entryType: true,
        settledAt: true,
        availableAt: true,
        revenueEventId: true,
      },
    });
    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Ledger entry not found" },
        { status: 404 },
      );
    }

    // Terminal states can only be re-disputed / re-reversed via
    // dedicated endpoints — PATCH is forbidden from resurrecting
    // settled entries.
    if (isSettledStatus(entry.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot PATCH an entry in terminal status "${entry.status}". Use /reverse (for paid→reversed disputes) or /dispute (for paid→disputed).`,
        },
        { status: 409 },
      );
    }

    // Validate transition
    if (!isValidTransition(entry.status, newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status transition: ${entry.status} → ${newStatus}`,
          from: entry.status,
          to: newStatus,
        },
        { status: 409 },
      );
    }

    // Compute derived timestamps
    const now = new Date();
    const updateData: {
      status: string;
      reasonCode?: string | null;
      internalNotes?: string | null;
      availableAt?: Date;
      settledAt?: Date;
    } = {
      status: newStatus,
    };
    if (reasonCode !== null) updateData.reasonCode = reasonCode;
    if (internalNotes !== null) updateData.internalNotes = internalNotes;

    // When moving to "payable", set availableAt (cleared for payout)
    if (newStatus === "payable" && !entry.availableAt) {
      updateData.availableAt = now;
    }
    // When moving to "paid", set settledAt
    if (newStatus === "paid" && !entry.settledAt) {
      updateData.settledAt = now;
    }

    const updated = await db.$transaction(async (tx) => {
      const e = await tx.royaltyLedgerEntry.update({
        where: { id },
        data: updateData,
      });

      // If confirmed → also mark the source revenue event confirmed
      if (newStatus === "confirmed" && entry.revenueEventId) {
        await tx.qualifyingRevenueEvent.updateMany({
          where: { id: entry.revenueEventId, status: { not: "confirmed" } },
          data: { status: "confirmed" },
        });
      }
      // If rejected → mark revenue event reversed (best-effort)
      if (newStatus === "rejected" && entry.revenueEventId) {
        await tx.qualifyingRevenueEvent.updateMany({
          where: { id: entry.revenueEventId },
          data: { status: "reversed" },
        });
      }

      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: entry.weddingId,
          action: ROYALTY_AUDIT_ACTIONS.LEDGER_STATUS_CHANGE,
          actorId,
          details: JSON.stringify({
            ledgerEntryId: id,
            from: entry.status,
            to: newStatus,
            reasonCode,
            internalNotes,
            amountMinor: entry.amountMinor,
            currency: entry.currency,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return e;
    });

    await logAuditEvent({
      action: "royalty.ledger.status_change",
      resourceType: "RoyaltyLedgerEntry",
      resourceId: id,
      beforeValue: { status: entry.status },
      afterValue: { status: newStatus, reasonCode, internalNotes },
      weddingId: entry.weddingId,
      actorId,
    });

    return NextResponse.json({
      success: true,
      ledgerEntry: {
        id: updated.id,
        status: updated.status,
        reasonCode: updated.reasonCode,
        internalNotes: updated.internalNotes,
        availableAt: updated.availableAt?.toISOString() ?? null,
        settledAt: updated.settledAt?.toISOString() ?? null,
        updatedAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[ROYALTY LEDGER PATCH] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update ledger entry" },
      { status: 500 },
    );
  }
}

// ─── POST /api/royalty/ledger/[id]/reverse ─────────────────
/**
 * Body: { reasonCode, internalNotes, actorId? }
 *
 * Reversal semantics:
 *   • Creates a NEW ledger entry with entryType="reversal",
 *     amountMinor = -original.amountMinor, status="reversed",
 *     reversalOfEntryId = original.id.
 *   • Sets the ORIGINAL entry's status to "reversed".
 *   • If the original is linked to a revenue event, marks the
 *     revenue event as "reversed" as well.
 *
 * Reversals of reversals are NOT permitted — the original
 * must be reinstated via a new accrual if needed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "reverse";

  if (action !== "reverse") {
    return NextResponse.json(
      { success: false, error: `Unknown sub-action: ${action}` },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as ReversePayload;
    const reasonCode = body.reasonCode?.trim();
    const internalNotes = body.internalNotes?.trim() || null;
    const actorId = body.actorId?.trim() || "admin";

    if (!reasonCode) {
      return NextResponse.json(
        { success: false, error: "reasonCode is required to reverse an entry" },
        { status: 400 },
      );
    }

    const original = await db.royaltyLedgerEntry.findUnique({
      where: { id },
      select: {
        id: true,
        weddingId: true,
        revenueEventId: true,
        entryType: true,
        amountMinor: true,
        currency: true,
        royaltyRateBasisPoints: true,
        status: true,
        publicDescription: true,
        reversalOfEntryId: true,
        createdAt: true,
      },
    });
    if (!original) {
      return NextResponse.json(
        { success: false, error: "Ledger entry not found" },
        { status: 404 },
      );
    }

    // You cannot reverse a reversal — reversals are themselves terminal.
    if (original.entryType === "reversal") {
      return NextResponse.json(
        { success: false, error: "Cannot reverse a reversal entry" },
        { status: 409 },
      );
    }
    if (original.status === "reversed") {
      return NextResponse.json(
        {
          success: false,
          error: "Entry is already reversed",
          alreadyReversed: true,
        },
        { status: 409 },
      );
    }

    const now = new Date();

    const result = await db.$transaction(async (tx) => {
      // 1. Mark original as reversed
      const updated = await tx.royaltyLedgerEntry.update({
        where: { id },
        data: {
          status: "reversed",
          reasonCode,
          internalNotes,
        },
      });

      // 2. Create compensating reversal entry (negative amount)
      const reversal = await tx.royaltyLedgerEntry.create({
        data: {
          weddingId: original.weddingId,
          revenueEventId: original.revenueEventId,
          entryType: "reversal",
          amountMinor: -original.amountMinor,
          currency: original.currency,
          royaltyRateBasisPoints: original.royaltyRateBasisPoints,
          status: "reversed",
          settledAt: now,
          reversalOfEntryId: original.id,
          reasonCode,
          publicDescription: `Reversal of ${original.publicDescription}`,
          internalNotes,
          createdBy: actorId,
        },
      });

      // 3. Mark the revenue event reversed
      if (original.revenueEventId) {
        await tx.qualifyingRevenueEvent.update({
          where: { id: original.revenueEventId },
          data: { status: "reversed" },
        });
      }

      // 4. Audit
      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: original.weddingId,
          action: ROYALTY_AUDIT_ACTIONS.REVENUE_REVERSE,
          actorId,
          details: JSON.stringify({
            originalLedgerEntryId: original.id,
            reversalLedgerEntryId: reversal.id,
            originalStatus: original.status,
            originalAmountMinor: original.amountMinor,
            reversalAmountMinor: -original.amountMinor,
            reasonCode,
            internalNotes,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return { updated, reversal };
    });

    await logAuditEvent({
      action: "royalty.ledger.reverse",
      resourceType: "RoyaltyLedgerEntry",
      resourceId: id,
      beforeValue: { status: original.status, amountMinor: original.amountMinor },
      afterValue: {
        status: "reversed",
        reversalEntryId: result.reversal.id,
        reasonCode,
      },
      weddingId: original.weddingId,
      actorId,
    });

    return NextResponse.json({
      success: true,
      originalEntry: {
        id: result.updated.id,
        status: result.updated.status,
        reasonCode: result.updated.reasonCode,
        internalNotes: result.updated.internalNotes,
      },
      reversalEntry: {
        id: result.reversal.id,
        entryType: result.reversal.entryType,
        amountMinor: result.reversal.amountMinor,
        status: result.reversal.status,
        reversalOfEntryId: result.reversal.reversalOfEntryId,
        reasonCode: result.reversal.reasonCode,
        publicDescription: result.reversal.publicDescription,
        settledAt: result.reversal.settledAt?.toISOString() ?? null,
        createdAt: result.reversal.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[ROYALTY LEDGER REVERSE] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reverse ledger entry" },
      { status: 500 },
    );
  }
}
