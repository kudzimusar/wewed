import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { maskAccountReference } from "@/lib/royalty-engine";
import {
  requireWewedAdmin,
  WewedAdminAccessError,
} from "@/lib/wewed-admin";
import { payoutMutationsDisabledPayload } from "@/lib/royalty-payout-security";

/* ============================================================
   /api/royalty/payout-account
   ------------------------------------------------------------
   • GET  ?slug=...
       List payout accounts for a wedding. Returns masked
       account references only — never the encrypted value.
       Restricted to active Wewed platform administrators with
       billing read permission.

   • POST
       Disabled until payout account references can be stored by
       the production secrets/KMS boundary.
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

function errorResponse(error: unknown, method: "GET" | "POST") {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }

  console.error(`[ROYALTY PAYOUT-ACCOUNT ${method}] error:`, error);
  return NextResponse.json(
    { success: false, error: "Failed to process payout account request" },
    { status: 500 },
  );
}

// ─── GET /api/royalty/payout-account ──────────────────────
export async function GET(request: NextRequest) {
  try {
    await requireWewedAdmin(request, "admin.billing.read");

    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") ?? FLAGSHIP_SLUG;

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

    const accounts = await db.royaltyPayoutAccount.findMany({
      where: { weddingId: wedding.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        maskedAccountDisplay: true,
        currency: true,
        country: true,
        status: true,
        verificationStatus: true,
        approvedBy: true,
        approvedAt: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { payoutRequests: true } },
      },
    });

    const data = accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      maskedAccountDisplay:
        account.maskedAccountDisplay ?? maskAccountReference(""),
      currency: account.currency,
      country: account.country,
      status: account.status,
      verificationStatus: account.verificationStatus,
      approvedBy: account.approvedBy,
      approvedAt: account.approvedAt?.toISOString() ?? null,
      createdBy: account.createdBy,
      payoutRequestCount: account._count.payoutRequests,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return errorResponse(error, "GET");
  }
}

// ─── POST /api/royalty/payout-account ─────────────────────
export async function POST(request: NextRequest) {
  try {
    await requireWewedAdmin(request, "admin.billing.manage");
    return NextResponse.json(payoutMutationsDisabledPayload(), {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, "POST");
  }
}
