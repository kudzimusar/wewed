import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-gate";
import { logAuditEvent } from "@/lib/audit";
import {
  ROYALTY_AUDIT_ACTIONS,
  maskAccountReference,
  encodeAccountReferenceMVP,
  decodeAccountReferenceMVP,
} from "@/lib/royalty-engine";

/* ============================================================
   /api/royalty/payout-account
   ------------------------------------------------------------
   • GET  ?slug=...
       List payout accounts for a wedding. Returns masked
       account references only — never the encrypted value.
       Admin-gated.

   • POST { slug, provider, accountReference, currency?, country? }
       Add a payout account. The accountReference is "encrypted"
       (base64 for MVP — production MUST use AES-256-GCM with a
       KMS-backed key). New accounts start as
       pending_verification and must be approved by an admin
       before payouts can be requested against them.
       Admin-gated.
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

const VALID_PROVIDERS = [
  "manual",
  "mobile_money",
  "bank_transfer",
  "platform_credit",
] as const;

// ─── GET /api/royalty/payout-account ───────────────────────
export async function GET(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
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
      include: {
        _count: { select: { payoutRequests: true } },
      },
    });

    const data = accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      maskedAccountDisplay: a.maskedAccountDisplay ?? maskAccountReference(""),
      currency: a.currency,
      country: a.country,
      status: a.status,
      verificationStatus: a.verificationStatus,
      approvedBy: a.approvedBy,
      approvedAt: a.approvedAt?.toISOString() ?? null,
      createdBy: a.createdBy,
      payoutRequestCount: a._count.payoutRequests,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("[ROYALTY PAYOUT-ACCOUNT GET] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payout accounts" },
      { status: 500 },
    );
  }
}

// ─── POST /api/royalty/payout-account ──────────────────────
interface AddAccountPayload {
  slug?: string;
  provider?: string;
  accountReference?: string;
  currency?: string;
  country?: string;
  actorId?: string;
  // Optional: pre-set verification status for manual ops.
  // Defaults to "pending_verification".
  status?: string;
}

export async function POST(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const body = (await request.json()) as AddAccountPayload;
    const slug = body.slug?.trim() || FLAGSHIP_SLUG;
    const provider = body.provider?.trim();
    const accountReference = body.accountReference?.trim();
    const currency = body.currency?.trim().toUpperCase() || "USD";
    const country = body.country?.trim().toUpperCase() || null;
    const actorId = body.actorId?.trim() || "admin";

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "provider is required" },
        { status: 400 },
      );
    }
    if (!(VALID_PROVIDERS as readonly string[]).includes(provider)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid provider. Valid: ${VALID_PROVIDERS.join(", ")}`,
        },
        { status: 400 },
      );
    }
    if (!accountReference || accountReference.length < 3) {
      return NextResponse.json(
        { success: false, error: "accountReference is required (min 3 chars)" },
        { status: 400 },
      );
    }
    if (accountReference.length > 256) {
      return NextResponse.json(
        { success: false, error: "accountReference too long (max 256 chars)" },
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

    // ⚠️  MVP encryption: base64 only. NOT secure for production.
    // See encodeAccountReferenceMVP docstring in royalty-engine.ts.
    const encrypted = encodeAccountReferenceMVP(accountReference);
    const masked = maskAccountReference(accountReference);

    const initialStatus =
      body.status && body.status === "verified" ? "verified" : "pending_verification";

    const account = await db.$transaction(async (tx) => {
      const acc = await tx.royaltyPayoutAccount.create({
        data: {
          weddingId: wedding.id,
          provider,
          accountReferenceEncrypted: encrypted,
          maskedAccountDisplay: masked,
          currency,
          country,
          status: initialStatus,
          verificationStatus: initialStatus === "verified" ? "verified" : "pending",
          createdBy: actorId,
          approvedBy: initialStatus === "verified" ? actorId : null,
          approvedAt: initialStatus === "verified" ? new Date() : null,
        },
      });

      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: wedding.id,
          action: ROYALTY_AUDIT_ACTIONS.PAYOUT_ACCOUNT_CHANGE,
          actorId,
          details: JSON.stringify({
            action: "add",
            payoutAccountId: acc.id,
            provider,
            masked,
            currency,
            country,
            initialStatus,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return acc;
    });

    await logAuditEvent({
      action: "royalty.payout_account.add",
      resourceType: "RoyaltyPayoutAccount",
      resourceId: account.id,
      afterValue: { provider, masked, currency, country, status: account.status },
      weddingId: wedding.id,
      actorId,
    });

    return NextResponse.json(
      {
        success: true,
        account: {
          id: account.id,
          provider: account.provider,
          maskedAccountDisplay: account.maskedAccountDisplay,
          currency: account.currency,
          country: account.country,
          status: account.status,
          verificationStatus: account.verificationStatus,
          approvedBy: account.approvedBy,
          approvedAt: account.approvedAt?.toISOString() ?? null,
          createdAt: account.createdAt.toISOString(),
          // ⚠️  Returned ONLY for MVP ops debugging — never expose
          // to couples in production. Real deployment must strip
          // this from the response and require a separate
          // "decrypt" admin action.
          _debugDecryptedReference: decodeAccountReferenceMVP(account.accountReferenceEncrypted ?? ""),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[ROYALTY PAYOUT-ACCOUNT POST] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add payout account" },
      { status: 500 },
    );
  }
}
