import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-gate";
import { logAuditEvent } from "@/lib/audit";
import {
  ROYALTY_AUDIT_ACTIONS,
  DISPUTE_STATUSES,
  isValidDisputeTransition,
  isValidTransition,
} from "@/lib/royalty-engine";

/* ============================================================
   /api/royalty/dispute
   ------------------------------------------------------------
   • GET  ?slug=...&status=...
       List disputes for a wedding. Admin-gated.

   • POST { slug, ledgerEntryId, reason, evidence?, actorId? }
       Raise a dispute against a ledger entry. Flow:
         • Validates the ledger entry exists & belongs to the
           wedding.
         • Validates the entry's status allows dispute (any
           non-terminal status except "rejected").
         • Creates RoyaltyDispute (status="open").
         • Sets ledger entry status to "disputed".
         • Creates audit event.
       Admin-gated.

   Disputes are append-only — to "resolve" a dispute, PATCH
   the dispute via the [id] sub-route (planned for a follow-up
   task). This endpoint only creates disputes.
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

// ─── GET /api/royalty/dispute ──────────────────────────────
export async function GET(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") ?? FLAGSHIP_SLUG;
    const status = url.searchParams.get("status");

    if (status && !(DISPUTE_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status filter: ${status}` },
        { status: 400 },
      );
    }

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

    const disputes = await db.royaltyDispute.findMany({
      where: {
        weddingId: wedding.id,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        ledgerEntry: {
          select: {
            id: true,
            entryType: true,
            amountMinor: true,
            currency: true,
            status: true,
            publicDescription: true,
            revenueEvent: {
              select: { sourceType: true, partnerId: true, externalReference: true },
            },
          },
        },
      },
    });

    const data = disputes.map((d) => ({
      id: d.id,
      weddingId: d.weddingId,
      ledgerEntryId: d.ledgerEntryId,
      raisedBy: d.raisedBy,
      reason: d.reason,
      evidence: d.evidence ? safeParseJSON(d.evidence) : null,
      status: d.status,
      resolution: d.resolution,
      resolvedBy: d.resolvedBy,
      createdAt: d.createdAt.toISOString(),
      resolvedAt: d.resolvedAt?.toISOString() ?? null,
      ledgerEntry: d.ledgerEntry
        ? {
            id: d.ledgerEntry.id,
            entryType: d.ledgerEntry.entryType,
            amountMinor: d.ledgerEntry.amountMinor,
            currency: d.ledgerEntry.currency,
            status: d.ledgerEntry.status,
            publicDescription: d.ledgerEntry.publicDescription,
            sourceType: d.ledgerEntry.revenueEvent?.sourceType ?? null,
            partnerId: d.ledgerEntry.revenueEvent?.partnerId ?? null,
            externalReference: d.ledgerEntry.revenueEvent?.externalReference ?? null,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("[ROYALTY DISPUTE GET] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch disputes" },
      { status: 500 },
    );
  }
}

// ─── POST /api/royalty/dispute ─────────────────────────────
interface RaiseDisputePayload {
  slug?: string;
  ledgerEntryId?: string;
  reason?: string;
  evidence?: unknown;
  actorId?: string;
}

function safeParseJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export async function POST(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const body = (await request.json()) as RaiseDisputePayload;
    const slug = body.slug?.trim() || FLAGSHIP_SLUG;
    const ledgerEntryId = body.ledgerEntryId?.trim();
    const reason = body.reason?.trim();
    const actorId = body.actorId?.trim() || "admin";

    if (!ledgerEntryId) {
      return NextResponse.json(
        { success: false, error: "ledgerEntryId is required" },
        { status: 400 },
      );
    }
    if (!reason || reason.length < 10) {
      return NextResponse.json(
        { success: false, error: "reason is required (min 10 chars)" },
        { status: 400 },
      );
    }

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

    const entry = await db.royaltyLedgerEntry.findUnique({
      where: { id: ledgerEntryId },
      select: {
        id: true,
        weddingId: true,
        status: true,
        entryType: true,
        amountMinor: true,
        currency: true,
        publicDescription: true,
      },
    });
    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Ledger entry not found" },
        { status: 404 },
      );
    }
    if (entry.weddingId !== wedding.id) {
      return NextResponse.json(
        { success: false, error: "Ledger entry does not belong to this wedding" },
        { status: 403 },
      );
    }
    // You cannot dispute a reversal entry (it's the correction itself).
    if (entry.entryType === "reversal") {
      return NextResponse.json(
        { success: false, error: "Cannot dispute a reversal entry" },
        { status: 409 },
      );
    }
    // Already reversed → no point disputing.
    if (entry.status === "reversed") {
      return NextResponse.json(
        { success: false, error: "Cannot dispute an already-reversed entry" },
        { status: 409 },
      );
    }
    // Validate state transition to "disputed".
    if (!isValidTransition(entry.status, "disputed")) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot dispute an entry in status "${entry.status}"`,
        },
        { status: 409 },
      );
    }

    // Encode evidence as JSON string for storage.
    const evidenceStr = body.evidence !== undefined ? JSON.stringify(body.evidence) : null;

    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      // 1. Create the dispute record
      const dispute = await tx.royaltyDispute.create({
        data: {
          weddingId: wedding.id,
          ledgerEntryId,
          raisedBy: actorId,
          reason,
          evidence: evidenceStr,
          status: "open",
        },
      });

      // 2. Flip the ledger entry status to "disputed"
      const updatedEntry = await tx.royaltyLedgerEntry.update({
        where: { id: ledgerEntryId },
        data: {
          status: "disputed",
          internalNotes: `Dispute raised: ${dispute.id}`,
        },
      });

      // 3. Audit
      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: wedding.id,
          action: ROYALTY_AUDIT_ACTIONS.DISPUTE_RAISE,
          actorId,
          details: JSON.stringify({
            disputeId: dispute.id,
            ledgerEntryId,
            previousStatus: entry.status,
            newStatus: "disputed",
            reason,
            hasEvidence: evidenceStr !== null,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return { dispute, updatedEntry };
    });

    await logAuditEvent({
      action: "royalty.dispute.raise",
      resourceType: "RoyaltyDispute",
      resourceId: result.dispute.id,
      weddingId: wedding.id,
      afterValue: {
        ledgerEntryId,
        reason,
        previousStatus: entry.status,
        newStatus: "disputed",
      },
      actorId,
    });

    return NextResponse.json(
      {
        success: true,
        dispute: {
          id: result.dispute.id,
          weddingId: result.dispute.weddingId,
          ledgerEntryId: result.dispute.ledgerEntryId,
          raisedBy: result.dispute.raisedBy,
          reason: result.dispute.reason,
          evidence: result.dispute.evidence ? safeParseJSON(result.dispute.evidence) : null,
          status: result.dispute.status,
          createdAt: result.dispute.createdAt.toISOString(),
        },
        ledgerEntry: {
          id: result.updatedEntry.id,
          previousStatus: entry.status,
          status: result.updatedEntry.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[ROYALTY DISPUTE POST] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to raise dispute" },
      { status: 500 },
    );
  }
}
