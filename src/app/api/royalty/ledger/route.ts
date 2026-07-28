import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-gate";
import { logAuditEvent } from "@/lib/audit";
import {
  ROYALTY_AUDIT_ACTIONS,
  LEDGER_STATUSES,
  REVENUE_SOURCE_TYPES,
  formatMinor,
} from "@/lib/royalty-engine";

/* ============================================================
   /api/royalty/ledger
   ------------------------------------------------------------
   • GET  ?slug=...&status=...&sourceType=...&fromDate=...
            &toDate=...&format=csv
       Filtered ledger query for a wedding. Supports CSV export
       for accounting reconciliation. Admin-gated.

   Returns:
     { data: RoyaltyLedgerEntry[], total, summary }
     (or text/csv when ?format=csv)

   Filtering:
     • slug       — required (defaults to flagship)
     • status     — single ledger status (estimated|pending|...)
     • sourceType — single source type (merchandise|travel|...)
     • fromDate   — ISO date, inclusive
     • toDate     — ISO date, inclusive
     • format     — "csv" returns a CSV download
     • limit      — default 200, max 1000
     • offset     — for pagination
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

const CSV_HEADERS = [
  "ledgerEntryId",
  "weddingId",
  "createdAt",
  "entryType",
  "status",
  "sourceType",
  "partnerId",
  "externalReference",
  "amountMinor",
  "amountDisplay",
  "currency",
  "royaltyRateBasisPoints",
  "reasonCode",
  "publicDescription",
  "internalNotes",
  "settledAt",
  "reversalOfEntryId",
];

// ─── GET /api/royalty/ledger ───────────────────────────────
export async function GET(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") ?? FLAGSHIP_SLUG;
    const status = url.searchParams.get("status");
    const sourceType = url.searchParams.get("sourceType");
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");
    const format = url.searchParams.get("format")?.toLowerCase();
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

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

    // Validate filters
    if (status && !(LEDGER_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status filter: ${status}` },
        { status: 400 },
      );
    }
    if (
      sourceType &&
      !(REVENUE_SOURCE_TYPES as readonly string[]).includes(sourceType)
    ) {
      return NextResponse.json(
        { success: false, error: `Invalid sourceType filter: ${sourceType}` },
        { status: 400 },
      );
    }

    const limit = Math.min(Math.max(parseInt(limitParam ?? "200", 10) || 200, 1), 1000);
    const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);

    // Build the where clause
    const where: {
      weddingId: string;
      status?: string;
      createdAt?: { gte?: Date; lte?: Date };
      revenueEvent?: { sourceType?: string };
    } = { weddingId: wedding.id };

    if (status) where.status = status;
    if (sourceType) {
      where.revenueEvent = { sourceType };
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        const d = new Date(fromDate);
        if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (toDate) {
        // Inclusive: add a full day
        const d = new Date(toDate);
        if (!Number.isNaN(d.getTime())) {
          d.setUTCHours(23, 59, 59, 999);
          where.createdAt.lte = d;
        }
      }
    }

    // Fetch entries + total count in parallel
    const [entries, total] = await Promise.all([
      db.royaltyLedgerEntry.findMany({
        where,
        include: {
          revenueEvent: {
            select: {
              id: true,
              sourceType: true,
              partnerId: true,
              externalReference: true,
              grossPlatformRevenueMinor: true,
              deductionsMinor: true,
              qualifyingNetRevenueMinor: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.royaltyLedgerEntry.count({ where }),
    ]);

    // Compute summary over the FILTERED set (not just the page).
    // For very large ledgers this could be expensive — consider a
    // materialised summary table for production scale.
    const summary = {
      count: entries.length,
      totalAmountMinor: 0,
      byStatus: {} as Record<string, number>,
      bySourceType: {} as Record<string, number>,
      byEntryType: {} as Record<string, number>,
    };
    for (const e of entries) {
      summary.totalAmountMinor += e.amountMinor;
      const statusKey = e.status;
      summary.byStatus[statusKey] = (summary.byStatus[statusKey] ?? 0) + e.amountMinor;
      const entryKey = e.entryType;
      summary.byEntryType[entryKey] = (summary.byEntryType[entryKey] ?? 0) + e.amountMinor;
      const srcKey = e.revenueEvent?.sourceType ?? "unknown";
      summary.bySourceType[srcKey] = (summary.bySourceType[srcKey] ?? 0) + e.amountMinor;
    }

    // ── CSV export ─────────────────────────────────────────
    if (format === "csv") {
      // Re-query without pagination so the CSV is the full filter set.
      const allEntries = await db.royaltyLedgerEntry.findMany({
        where,
        include: {
          revenueEvent: {
            select: {
              sourceType: true,
              partnerId: true,
              externalReference: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 10000, // hard safety cap; for larger exports use a background job
      });

      const currency = "USD"; // ledger currency is per-entry; CSV uses entry's own
      const lines = [csvRow(CSV_HEADERS)];
      for (const e of allEntries) {
        lines.push(
          csvRow([
            e.id,
            e.weddingId,
            e.createdAt.toISOString(),
            e.entryType,
            e.status,
            e.revenueEvent?.sourceType ?? "",
            e.revenueEvent?.partnerId ?? "",
            e.revenueEvent?.externalReference ?? "",
            e.amountMinor,
            formatMinor(e.amountMinor, e.currency ?? currency),
            e.currency ?? currency,
            e.royaltyRateBasisPoints,
            e.reasonCode ?? "",
            e.publicDescription,
            e.internalNotes ?? "",
            e.settledAt ? e.settledAt.toISOString() : "",
            e.reversalOfEntryId ?? "",
          ]),
        );
      }

      // Audit the export
      await db.royaltyAuditEvent.create({
        data: {
          weddingId: wedding.id,
          action: ROYALTY_AUDIT_ACTIONS.EXPORT,
          actorId: "admin",
          details: JSON.stringify({
            format: "csv",
            filters: { status, sourceType, fromDate, toDate },
            rowCount: allEntries.length,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });
      await logAuditEvent({
        action: "royalty.ledger.export",
        resourceType: "RoyaltyLedgerEntry",
        weddingId: wedding.id,
        afterValue: { format: "csv", rowCount: allEntries.length, filters: { status, sourceType, fromDate, toDate } },
      });

      const csv = lines.join("\r\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="royalty-ledger-${slug}-${Date.now()}.csv"`,
        },
      });
    }

    // ── JSON response ──────────────────────────────────────
    const data = entries.map((e) => ({
      id: e.id,
      weddingId: e.weddingId,
      revenueEventId: e.revenueEventId,
      entryType: e.entryType,
      amountMinor: e.amountMinor,
      amountDisplay: formatMinor(e.amountMinor, e.currency ?? "USD"),
      currency: e.currency ?? "USD",
      royaltyRateBasisPoints: e.royaltyRateBasisPoints,
      status: e.status,
      availableAt: e.availableAt?.toISOString() ?? null,
      settledAt: e.settledAt?.toISOString() ?? null,
      reversalOfEntryId: e.reversalOfEntryId,
      reasonCode: e.reasonCode,
      publicDescription: e.publicDescription,
      internalNotes: e.internalNotes,
      createdBy: e.createdBy,
      createdAt: e.createdAt.toISOString(),
      revenueEvent: e.revenueEvent
        ? {
            id: e.revenueEvent.id,
            sourceType: e.revenueEvent.sourceType,
            partnerId: e.revenueEvent.partnerId,
            externalReference: e.revenueEvent.externalReference,
            grossPlatformRevenueMinor: e.revenueEvent.grossPlatformRevenueMinor,
            deductionsMinor: e.revenueEvent.deductionsMinor,
            qualifyingNetRevenueMinor: e.revenueEvent.qualifyingNetRevenueMinor,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      total,
      count: entries.length,
      limit,
      offset,
      data,
      summary: {
        ...summary,
        totalAmountDisplay: formatMinor(summary.totalAmountMinor, "USD"),
      },
    });
  } catch (error) {
    console.error("[ROYALTY LEDGER GET] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch ledger entries" },
      { status: 500 },
    );
  }
}
