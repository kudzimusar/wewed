import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PAYOUT_STATUSES, formatMinor } from "@/lib/royalty-engine";
import {
  requireWewedAdmin,
  WewedAdminAccessError,
} from "@/lib/wewed-admin";
import { payoutMutationsDisabledPayload } from "@/lib/royalty-payout-security";

/* ============================================================
   /api/royalty/payout
   ------------------------------------------------------------
   • GET  ?slug=...&status=...
       List payout requests for a wedding. Restricted to active
       Wewed platform administrators with billing read permission.

   • POST / PATCH
       Disabled until production payout processing and secure
       payout account storage are configured.
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

type PayoutMethod = "GET" | "POST" | "PATCH";

function errorResponse(error: unknown, method: PayoutMethod) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }

  console.error(`[ROYALTY PAYOUT ${method}] error:`, error);
  return NextResponse.json(
    { success: false, error: "Failed to process payout request" },
    { status: 500 },
  );
}

function disabledResponse() {
  return NextResponse.json(payoutMutationsDisabledPayload(), {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

// ─── GET /api/royalty/payout ─────────────────────────────
export async function GET(request: NextRequest) {
  try {
    await requireWewedAdmin(request, "admin.billing.read");

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

    const data = requests.map((payoutRequest) => ({
      id: payoutRequest.id,
      weddingId: payoutRequest.weddingId,
      payoutAccountId: payoutRequest.payoutAccountId,
      amountMinor: payoutRequest.amountMinor,
      amountDisplay: formatMinor(
        payoutRequest.amountMinor,
        payoutRequest.currency,
      ),
      currency: payoutRequest.currency,
      status: payoutRequest.status,
      requestedBy: payoutRequest.requestedBy,
      approvedBy: payoutRequest.approvedBy,
      providerReference: payoutRequest.providerReference,
      failureReason: payoutRequest.failureReason,
      requestedAt: payoutRequest.requestedAt.toISOString(),
      approvedAt: payoutRequest.approvedAt?.toISOString() ?? null,
      processedAt: payoutRequest.processedAt?.toISOString() ?? null,
      paidAt: payoutRequest.paidAt?.toISOString() ?? null,
      payoutAccount: payoutRequest.payoutAccount,
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

// ─── POST /api/royalty/payout ────────────────────────────
export async function POST(request: NextRequest) {
  try {
    await requireWewedAdmin(request, "admin.billing.manage");
    return disabledResponse();
  } catch (error) {
    return errorResponse(error, "POST");
  }
}

// ─── PATCH /api/royalty/payout ───────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    await requireWewedAdmin(request, "admin.billing.manage");
    return disabledResponse();
  } catch (error) {
    return errorResponse(error, "PATCH");
  }
}
