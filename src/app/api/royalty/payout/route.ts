import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-gate";
import { logAuditEvent } from "@/lib/audit";
import {
  ROYALTY_AUDIT_ACTIONS,
  PAYOUT_STATUSES,
  VALID_PAYOUT_TRANSITIONS,
  isValidPayoutTransition,
  formatMinor,
} from "@/lib/royalty-engine";

/* ============================================================
   /api/royalty/payout
   ------------------------------------------------------------
   • GET  ?slug=...&status=...
       List payout requests for a wedding. Admin-gated.

   • POST { slug, payoutAccountId, amountMinor, actorId? }
       Create a payout request. Validates:
         • Programme is enrolled & active
         • Payout account is verified
         • amountMinor >= programme.minimumPayoutMinor
         • Sufficient payable balance (sum of payable ledger
           entries not already earmarked for another payout)
       On success:
         • Creates RoyaltyPayoutRequest (status="requested")
         • Earmarks sufficient payable ledger entries by
           setting them to "payout_requested", in FIFO order
         • Creates audit event
       Admin-gated.

   • PATCH ?id=...  { status, providerReference?, failureReason?, actorId? }
       Advance a payout request through its lifecycle:
         requested → approved → processing → paid
         (or cancelled / failed)
       When transitioning to "paid":
         • All earmarked ledger entries → "paid", settledAt set
         • Payout request paidAt set
       Admin-gated.
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

// ─── GET /api/royalty/payout ───────────────────────────────
export async function GET(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") ?? FLAGSHIP_SLUG;
    const status = url.searchParams.get("status");

    if (status && !(PAYOUT_STATUSES as readonly string[]).includes(status)) {
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

    const requests = await db.royaltyPayoutRequest.findMany({
      where: {
        weddingId: wedding.id,
        ...(status ? { status } : {}),
      },
      orderBy: { requestedAt: "desc" },
      include: {
        payoutAccount: {
          select: {
            id: true,
            provider: true,
            maskedAccountDisplay: true,
            currency: true,
            country: true,
            status: true,
          },
        },
      },
    });

    const data = requests.map((r) => ({
      id: r.id,
      weddingId: r.weddingId,
      payoutAccountId: r.payoutAccountId,
      amountMinor: r.amountMinor,
      amountDisplay: formatMinor(r.amountMinor, r.currency),
      currency: r.currency,
      status: r.status,
      requestedBy: r.requestedBy,
      approvedBy: r.approvedBy,
      providerReference: r.providerReference,
      failureReason: r.failureReason,
      requestedAt: r.requestedAt.toISOString(),
      approvedAt: r.approvedAt?.toISOString() ?? null,
      processedAt: r.processedAt?.toISOString() ?? null,
      paidAt: r.paidAt?.toISOString() ?? null,
      payoutAccount: r.payoutAccount,
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("[ROYALTY PAYOUT GET] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payout requests" },
      { status: 500 },
    );
  }
}

// ─── POST /api/royalty/payout ──────────────────────────────
interface CreatePayoutPayload {
  slug?: string;
  payoutAccountId?: string;
  amountMinor?: number;
  actorId?: string;
  providerReference?: string;
}

export async function POST(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const body = (await request.json()) as CreatePayoutPayload;
    const slug = body.slug?.trim() || FLAGSHIP_SLUG;
    const payoutAccountId = body.payoutAccountId?.trim();
    const amountMinor = body.amountMinor;
    const actorId = body.actorId?.trim() || "admin";
    const providerReference = body.providerReference?.trim() || null;

    if (!payoutAccountId) {
      return NextResponse.json(
        { success: false, error: "payoutAccountId is required" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(amountMinor) || amountMinor! <= 0) {
      return NextResponse.json(
        { success: false, error: "amountMinor must be a positive integer (cents)" },
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

    // Programme must be enrolled & active
    const programme = await db.royaltyProgramme.findUnique({
      where: { weddingId: wedding.id },
    });
    if (!programme || programme.enrolmentStatus !== "active") {
      return NextResponse.json(
        { success: false, error: "Royalty programme is not active for this wedding" },
        { status: 409 },
      );
    }

    // Payout account must exist, belong to this wedding, and be verified
    const account = await db.royaltyPayoutAccount.findUnique({
      where: { id: payoutAccountId },
    });
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Payout account not found" },
        { status: 404 },
      );
    }
    if (account.weddingId !== wedding.id) {
      return NextResponse.json(
        { success: false, error: "Payout account does not belong to this wedding" },
        { status: 403 },
      );
    }
    if (account.status !== "verified") {
      return NextResponse.json(
        {
          success: false,
          error: `Payout account status "${account.status}" — must be "verified"`,
        },
        { status: 409 },
      );
    }

    // Minimum payout check
    if (amountMinor! < programme.minimumPayoutMinor) {
      return NextResponse.json(
        {
          success: false,
          error: `Requested amount ${amountMinor} is below minimum payout ${programme.minimumPayoutMinor} minor units`,
          requestedMinor: amountMinor,
          minimumPayoutMinor: programme.minimumPayoutMinor,
        },
        { status: 400 },
      );
    }

    // Compute available payable balance — sum of ledger entries in
    // "payable" status (not yet earmarked for another payout).
    const payableEntries = await db.royaltyLedgerEntry.findMany({
      where: {
        weddingId: wedding.id,
        status: "payable",
        entryType: "accrual",
      },
      orderBy: { availableAt: "asc" }, // FIFO: oldest payable first
      select: { id: true, amountMinor: true, availableAt: true },
    });

    const totalPayableMinor = payableEntries.reduce(
      (acc, e) => acc + e.amountMinor,
      0,
    );

    if (amountMinor! > totalPayableMinor) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient payable balance",
          requestedMinor: amountMinor,
          availablePayableMinor: totalPayableMinor,
          shortfallMinor: amountMinor! - totalPayableMinor,
        },
        { status: 409 },
      );
    }

    // Earmark entries in FIFO order until the requested amount is covered.
    // We use a list of {id, amountMinor} and walk through them. If the
    // last entry is partially covered, we still flip it to
    // "payout_requested" (the partial-reserve pattern; a future release
    // may split the entry instead).
    const earmarked: { id: string; amountMinor: number }[] = [];
    let remaining = amountMinor!;
    for (const e of payableEntries) {
      if (remaining <= 0) break;
      earmarked.push({ id: e.id, amountMinor: e.amountMinor });
      remaining -= e.amountMinor;
    }

    const now = new Date();

    const payoutRequest = await db.$transaction(async (tx) => {
      // 1. Create the payout request
      const pr = await tx.royaltyPayoutRequest.create({
        data: {
          weddingId: wedding.id,
          payoutAccountId: payoutAccountId!,
          amountMinor: amountMinor!,
          currency: account.currency,
          status: "requested",
          requestedBy: actorId,
          requestedAt: now,
          providerReference,
        },
      });

      // 2. Earmark the ledger entries (flip to payout_requested)
      //    We track which entries were earmarked via metadata on
      //    the ledger entries' internalNotes field so the auditor
      //    can reconstruct which payout consumed which entry.
      for (const e of earmarked) {
        await tx.royaltyLedgerEntry.update({
          where: { id: e.id },
          data: {
            status: "payout_requested",
            internalNotes: `Earmarked for payout ${pr.id}`,
          },
        });
      }

      // 3. Audit
      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: wedding.id,
          action: ROYALTY_AUDIT_ACTIONS.PAYOUT_REQUEST,
          actorId,
          details: JSON.stringify({
            payoutRequestId: pr.id,
            payoutAccountId,
            amountMinor,
            currency: account.currency,
            earmarkedEntryIds: earmarked.map((e) => e.id),
            earmarkedTotalMinor: earmarked.reduce(
              (acc, e) => acc + e.amountMinor,
              0,
            ),
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return { pr, earmarked };
    });

    await logAuditEvent({
      action: "royalty.payout.request",
      resourceType: "RoyaltyPayoutRequest",
      resourceId: payoutRequest.pr.id,
      weddingId: wedding.id,
      afterValue: {
        amountMinor,
        payoutAccountId,
        earmarkedEntries: payoutRequest.earmarked.length,
      },
      actorId,
    });

    return NextResponse.json(
      {
        success: true,
        payoutRequest: {
          id: payoutRequest.pr.id,
          weddingId: payoutRequest.pr.weddingId,
          payoutAccountId: payoutRequest.pr.payoutAccountId,
          amountMinor: payoutRequest.pr.amountMinor,
          amountDisplay: formatMinor(payoutRequest.pr.amountMinor, payoutRequest.pr.currency),
          currency: payoutRequest.pr.currency,
          status: payoutRequest.pr.status,
          requestedBy: payoutRequest.pr.requestedBy,
          requestedAt: payoutRequest.pr.requestedAt.toISOString(),
        },
        earmarkedEntryCount: payoutRequest.earmarked.length,
        earmarkedEntryIds: payoutRequest.earmarked.map((e) => e.id),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[ROYALTY PAYOUT POST] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create payout request" },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/royalty/payout ─────────────────────────────
interface PayoutPatchPayload {
  status?: string;
  providerReference?: string;
  failureReason?: string;
  actorId?: string;
}

export async function PATCH(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "?id=<payoutRequestId> is required" },
        { status: 400 },
      );
    }

    const body = (await request.json()) as PayoutPatchPayload;
    const newStatus = body.status?.trim();
    const providerReference = body.providerReference?.trim() || null;
    const failureReason = body.failureReason?.trim() || null;
    const actorId = body.actorId?.trim() || "admin";

    if (!newStatus) {
      return NextResponse.json(
        { success: false, error: "status is required" },
        { status: 400 },
      );
    }
    if (!(PAYOUT_STATUSES as readonly string[]).includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status: ${newStatus}` },
        { status: 400 },
      );
    }

    const existing = await db.royaltyPayoutRequest.findUnique({
      where: { id },
      include: {
        payoutAccount: {
          select: { id: true, currency: true, status: true },
        },
      },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Payout request not found" },
        { status: 404 },
      );
    }

    if (!isValidPayoutTransition(existing.status, newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid payout transition: ${existing.status} → ${newStatus}`,
          validTransitions: VALID_PAYOUT_TRANSITIONS[existing.status] ?? [],
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const updateData: {
      status: string;
      providerReference?: string | null;
      failureReason?: string | null;
      approvedBy?: string;
      approvedAt?: Date;
      processedAt?: Date;
      paidAt?: Date;
    } = { status: newStatus };

    if (providerReference !== null) updateData.providerReference = providerReference;
    if (newStatus === "failed" && failureReason) {
      updateData.failureReason = failureReason;
    }

    if (newStatus === "approved") {
      updateData.approvedBy = actorId;
      updateData.approvedAt = now;
    }
    if (newStatus === "processing") {
      updateData.processedAt = now;
    }

    // For "paid": we need to flip all earmarked ledger entries to "paid".
    // Earmarked entries currently have status="payout_requested" and
    // internalNotes=`Earmarked for payout <id>`. We use a broader filter
    // (status IN [payout_requested]) AND internalNotes contains the id,
    // to be safe against accidental status drift.
    let ledgerUpdateCount = 0;
    if (newStatus === "paid") {
      updateData.paidAt = now;
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.royaltyPayoutRequest.update({
        where: { id },
        data: updateData,
      });

      if (newStatus === "paid") {
        // Flip all earmarked entries for this payout to "paid"
        const earmarked = await tx.royaltyLedgerEntry.findMany({
          where: {
            weddingId: existing.weddingId,
            status: "payout_requested",
            internalNotes: { contains: id },
          },
          select: { id: true, amountMinor: true },
        });
        for (const e of earmarked) {
          await tx.royaltyLedgerEntry.update({
            where: { id: e.id },
            data: {
              status: "paid",
              settledAt: now,
              internalNotes: `Settled by payout ${id}`,
            },
          });
        }
        ledgerUpdateCount = earmarked.length;
      } else if (newStatus === "failed" || newStatus === "cancelled") {
        // Release the earmark — entries go back to "payable" so they can
        // be re-earmarked for a future payout.
        const earmarked = await tx.royaltyLedgerEntry.findMany({
          where: {
            weddingId: existing.weddingId,
            status: "payout_requested",
            internalNotes: { contains: id },
          },
          select: { id: true },
        });
        for (const e of earmarked) {
          await tx.royaltyLedgerEntry.update({
            where: { id: e.id },
            data: {
              status: "payable",
              internalNotes: `Released from payout ${id} (${newStatus})`,
            },
          });
        }
        ledgerUpdateCount = earmarked.length;
      }

      // Determine audit action
      let auditAction: string = ROYALTY_AUDIT_ACTIONS.PAYOUT_APPROVE;
      if (newStatus === "processing") auditAction = "payout_process";
      if (newStatus === "paid") auditAction = "payout_paid";
      if (newStatus === "failed") auditAction = "payout_fail";

      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: existing.weddingId,
          action: auditAction,
          actorId,
          details: JSON.stringify({
            payoutRequestId: id,
            from: existing.status,
            to: newStatus,
            providerReference,
            failureReason,
            ledgerEntriesAffected: ledgerUpdateCount,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return { updated, ledgerUpdateCount };
    });

    await logAuditEvent({
      action: `royalty.payout.${newStatus}`,
      resourceType: "RoyaltyPayoutRequest",
      resourceId: id,
      beforeValue: { status: existing.status },
      afterValue: { status: newStatus, ledgerEntriesAffected: result.ledgerUpdateCount },
      weddingId: existing.weddingId,
      actorId,
    });

    return NextResponse.json({
      success: true,
      payoutRequest: {
        id: result.updated.id,
        status: result.updated.status,
        approvedBy: result.updated.approvedBy,
        approvedAt: result.updated.approvedAt?.toISOString() ?? null,
        processedAt: result.updated.processedAt?.toISOString() ?? null,
        paidAt: result.updated.paidAt?.toISOString() ?? null,
        providerReference: result.updated.providerReference,
        failureReason: result.updated.failureReason,
      },
      ledgerEntriesAffected: result.ledgerUpdateCount,
    });
  } catch (error) {
    console.error("[ROYALTY PAYOUT PATCH] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update payout request" },
      { status: 500 },
    );
  }
}
