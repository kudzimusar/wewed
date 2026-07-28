/* ============================================================
 * royalty-engine.ts
 * ------------------------------------------------------------
 * Core calculation & state machine engine for the wewed
 * Royalty revenue-sharing programme.
 *
 * PRINCIPLES
 * ─────────
 *  1. Integer-only money. Every monetary value is expressed
 *     in minor units (cents). Floating-point is FORBIDDEN in
 *     financial calculation paths.
 *  2. Append-only ledger. Confirmed entries are never edited;
 *     corrections are made via compensating reversal entries.
 *  3. Explicit state transitions. Status changes must pass
 *     `isValidTransition`; invalid moves are rejected.
 *  4. Idempotency-first. Every revenue event & webhook must
 *     carry a unique idempotency key.
 *
 * This module is pure: no DB calls, no side effects.
 * Importable from both server routes and edge-safe utilities.
 * ============================================================ */

// ── 1. Royalty rate (centrally configurable) ────────────────
/**
 * Default royalty rate in basis points.
 * 500 = 5.00% (500 / 10000).
 *
 * Stored per-programme in `RoyaltyProgramme.royaltyRateBasisPoints`,
 * but this constant is the system default and the single place
 * to change it for new enrolments.
 */
export const ROYALTY_RATE_BASIS_POINTS = 500;

/**
 * Default minimum payout in minor units (e.g. $25.00 USD).
 * Programmes may override; this is the platform default.
 */
export const DEFAULT_MINIMUM_PAYOUT_MINOR = 2500;

// ── 2. Revenue source taxonomy ──────────────────────────────
/**
 * Revenue source types eligible for royalty participation.
 * A "source type" is the channel through which revenue flows
 * into wewed (vendor marketplace, travel bookings, merch, etc.).
 */
export const REVENUE_SOURCE_TYPES = [
  "merchandise",
  "travel",
  "vendor",
  "venue",
  "referral",
  "advertising",
  "clothing",
] as const;

export type RevenueSourceType = (typeof REVENUE_SOURCE_TYPES)[number];

/**
 * Revenue categories explicitly excluded from the royalty pool.
 * These are typically wewed's own subscription/fee income or
 * partner-funded credits that should not be shared.
 */
export const EXCLUDED_REVENUE_TYPES = [
  "subscription_fee",
  "platform_credit",
  "internal_transfer",
  "tax_collected",
  "donation_to_wewed",
  "referral_bonus_paid",
] as const;

export type ExcludedRevenueType = (typeof EXCLUDED_REVENUE_TYPES)[number];

// ── 3. Attribution windows (days per source type) ───────────
/**
 * Number of days after the first touch that a conversion can
 * still be attributed to a wedding's referral. Configurable
 * per source type because conversion cycles vary wildly:
 *
 *   • merchandise  → impulse purchase, short window
 *   • travel       → considered purchase, longer window
 *   • vendor/venue → wedding planning cycles, long windows
 *   • referral     → loyalty-style, longest window
 */
export const ATTRIBUTION_WINDOWS: Record<string, number> = {
  merchandise: 30,
  travel: 90,
  vendor: 180,
  venue: 180,
  referral: 365,
  advertising: 30,
  clothing: 30,
};

export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;

/**
 * Look up the attribution window for a source type, falling
 * back to the platform default if the type is unknown.
 */
export function getAttributionWindowDays(sourceType: string): number {
  return ATTRIBUTION_WINDOWS[sourceType] ?? DEFAULT_ATTRIBUTION_WINDOW_DAYS;
}

// ── 4. Monetisation categories (preferences) ────────────────
/**
 * All categories that a couple can opt into for monetisation.
 * All default to disabled at enrolment — couples must explicitly
 * approve each channel.
 */
export const MONETISATION_CATEGORIES = [
  "venue",
  "vendors",
  "travel",
  "merchandise",
  "advertising",
  "clothing",
  "memory_books",
  "anniversary",
  "referrals",
] as const;

export type MonetisationCategory = (typeof MONETISATION_CATEGORIES)[number];

// ── 5. Ledger status state machine ──────────────────────────
/**
 * All possible lifecycle states for a RoyaltyLedgerEntry.
 *
 *  estimated        → revenue recognised but not yet verified
 *  pending          → event recorded, awaiting confirmation
 *  confirmed        → partner revenue confirmed, awaiting clearing
 *  payable          → cleared and available for payout
 *  payout_requested → earmarked for an in-flight payout
 *  processing       → payout is being executed by the provider
 *  paid             → funds delivered to the couple
 *  reversed         → entry voided (compensating entry created)
 *  disputed         → under dispute, frozen
 *  rejected         → never reached confirmation
 */
export const LEDGER_STATUSES = [
  "estimated",
  "pending",
  "confirmed",
  "payable",
  "payout_requested",
  "processing",
  "paid",
  "reversed",
  "disputed",
  "rejected",
] as const;

export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

/**
 * Valid forward / lateral state transitions for ledger entries.
 * Self-transitions are allowed (idempotent re-confirmation),
 * but any move NOT listed here is rejected.
 *
 * Special transitions:
 *   • any → reversed        (only via the reversal endpoint)
 *   • any → disputed        (only via the dispute endpoint)
 *   • any → rejected        (reviewer action)
 */
export const VALID_STATE_TRANSITIONS: Record<string, string[]> = {
  estimated: ["pending", "rejected", "disputed", "reversed"],
  pending: ["confirmed", "estimated", "rejected", "disputed", "reversed"],
  confirmed: ["payable", "rejected", "disputed", "reversed"],
  payable: ["payout_requested", "disputed", "reversed"],
  payout_requested: ["processing", "payable", "disputed", "reversed"],
  processing: ["paid", "payable", "disputed", "reversed"],
  paid: ["disputed", "reversed"],
  reversed: [], // terminal
  disputed: ["confirmed", "payable", "rejected", "reversed"],
  rejected: [], // terminal
};

/**
 * Returns true if moving a ledger entry from `from` to `to`
 * is a permitted state transition.
 *
 * Self-transitions (from === to) are allowed for idempotency.
 */
export function isValidTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = VALID_STATE_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Whether a status represents a "settled" (post-payout) state.
 */
export function isSettledStatus(status: string): boolean {
  return status === "paid" || status === "reversed";
}

/**
 * Whether a status contributes to the couple's payable balance.
 * Payable + payout_requested + processing all represent funds
 * that have cleared but not yet been delivered.
 */
export function isPayableStatus(status: string): boolean {
  return (
    status === "payable" ||
    status === "payout_requested" ||
    status === "processing"
  );
}

/**
 * Whether a status counts toward the couple's "earned" total
 * (i.e. has crossed the confirmation threshold).
 */
export function isEarnedStatus(status: string): boolean {
  return (
    status === "confirmed" ||
    status === "payable" ||
    status === "payout_requested" ||
    status === "processing" ||
    status === "paid"
  );
}

// ── 6. Payout request status state machine ──────────────────
export const PAYOUT_STATUSES = [
  "requested",
  "approved",
  "processing",
  "paid",
  "failed",
  "cancelled",
] as const;

export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const VALID_PAYOUT_TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "cancelled", "failed"],
  approved: ["processing", "cancelled", "failed"],
  processing: ["paid", "failed"],
  paid: [],
  failed: [],
  cancelled: [],
};

export function isValidPayoutTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = VALID_PAYOUT_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

// ── 7. Dispute status ───────────────────────────────────────
export const DISPUTE_STATUSES = [
  "open",
  "under_review",
  "resolved",
  "rejected",
] as const;

export const VALID_DISPUTE_TRANSITIONS: Record<string, string[]> = {
  open: ["under_review", "resolved", "rejected"],
  under_review: ["resolved", "rejected", "open"],
  resolved: [],
  rejected: [],
};

export function isValidDisputeTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = VALID_DISPUTE_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

// ── 8. Deduction model ──────────────────────────────────────
/**
 * A single deduction applied to gross platform revenue
 * to arrive at qualifying net revenue.
 *
 * Common `type` values: "refund", "chargeback", "tax",
 * "payment_processing_fee", "direct_cost", "partner_commission",
 * "currency_conversion", "other".
 */
export interface Deduction {
  type: string;
  amountMinor: number;
  reason: string;
}

// ── 9. Core money math (integer-only) ───────────────────────
/**
 * Calculate the royalty owed on a qualifying net revenue amount.
 *
 *   royalty = floor(qualifyingNetRevenueMinor * basisPoints / 10000)
 *
 * Floor (not round) so the platform never over-pays couples
 * on fractional cent amounts.
 *
 * @param qualifyingNetRevenueMinor - net revenue in minor units (cents)
 * @param basisPoints               - royalty rate in basis points (500 = 5%)
 * @returns royalty amount in minor units (always an integer ≥ 0)
 */
export function calculateRoyalty(
  qualifyingNetRevenueMinor: number,
  basisPoints: number = ROYALTY_RATE_BASIS_POINTS,
): number {
  // Validate inputs — reject anything that would corrupt the ledger.
  if (!Number.isInteger(qualifyingNetRevenueMinor)) {
    throw new Error(
      `calculateRoyalty: qualifyingNetRevenueMinor must be an integer, got ${qualifyingNetRevenueMinor}`,
    );
  }
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) {
    throw new Error(
      `calculateRoyalty: basisPoints must be an integer in [0, 10000], got ${basisPoints}`,
    );
  }
  if (qualifyingNetRevenueMinor < 0) return 0;
  return Math.floor((qualifyingNetRevenueMinor * basisPoints) / 10000);
}

/**
 * Compute the qualifying net revenue from gross platform revenue
 * minus a list of deductions.
 *
 * @returns { qualifyingNetRevenueMinor, totalDeductionsMinor }
 *
 * `qualifyingNetRevenueMinor` is clamped to ≥ 0 — refunds can
 * never produce negative qualifying revenue (those are handled
 * via reversals of previously-accrued entries).
 */
export function calculateQualifyingRevenue(
  grossPlatformRevenueMinor: number,
  deductions: Deduction[],
): {
  qualifyingNetRevenueMinor: number;
  totalDeductionsMinor: number;
} {
  if (!Number.isInteger(grossPlatformRevenueMinor)) {
    throw new Error(
      `calculateQualifyingRevenue: grossPlatformRevenueMinor must be an integer, got ${grossPlatformRevenueMinor}`,
    );
  }
  if (grossPlatformRevenueMinor < 0) {
    throw new Error(
      `calculateQualifyingRevenue: grossPlatformRevenueMinor must be ≥ 0, got ${grossPlatformRevenueMinor}`,
    );
  }

  let totalDeductionsMinor = 0;
  for (const d of deductions ?? []) {
    if (!Number.isInteger(d.amountMinor)) {
      throw new Error(
        `calculateQualifyingRevenue: deduction.amountMinor must be an integer, got ${d.amountMinor}`,
      );
    }
    if (d.amountMinor < 0) {
      throw new Error(
        `calculateQualifyingRevenue: deduction.amountMinor must be ≥ 0, got ${d.amountMinor}`,
      );
    }
    totalDeductionsMinor += d.amountMinor;
  }

  // Clamp to ≥ 0 — over-deduction is a config error, but we
  // never want to record negative qualifying revenue.
  const qualifyingNetRevenueMinor = Math.max(
    0,
    grossPlatformRevenueMinor - totalDeductionsMinor,
  );

  return { qualifyingNetRevenueMinor, totalDeductionsMinor };
}

// ── 10. Money formatting & parsing ──────────────────────────
/**
 * Minor-unit (cents) amount → human-readable display string.
 *
 * Examples:
 *   formatMinor(12345, "USD") → "123.45 USD"
 *   formatMinor(0, "USD")     → "0.00 USD"
 *   formatMinor(-500, "USD")  → "-5.00 USD"
 *
 * Always shows 2 decimal places (standard for fiat currencies
 * in the wewed programme). For 0-decimal currencies (JPY, etc.)
 * a separate formatter would be needed — out of scope for MVP.
 */
export function formatMinor(amountMinor: number, currency: string = "USD"): string {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`formatMinor: amount must be an integer, got ${amountMinor}`);
  }
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const majorStr = major.toLocaleString("en-US");
  const minorStr = minor.toString().padStart(2, "0");
  const sign = negative ? "-" : "";
  return `${sign}${majorStr}.${minorStr} ${currency}`;
}

/**
 * Display amount string → minor units (integer cents).
 *
 * Accepts:
 *   • "123.45"      → 12345
 *   • "$123.45"     → 12345
 *   • "1,234.56"    → 123456
 *   • "1234"        → 123400
 *   • "0.5"         → 50
 *
 * Throws on malformed input — callers should validate.
 */
export function parseToMinor(amount: string): number {
  if (typeof amount !== "string") {
    throw new Error(`parseToMinor: expected string, got ${typeof amount}`);
  }
  const trimmed = amount.trim().replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`parseToMinor: malformed amount "${amount}"`);
  }
  const negative = trimmed.startsWith("-");
  const digits = negative ? trimmed.slice(1) : trimmed;
  const [whole, frac = ""] = digits.split(".");
  const paddedFrac = (frac + "00").slice(0, 2);
  const value = parseInt(whole, 10) * 100 + parseInt(paddedFrac, 10);
  return negative ? -value : value;
}

// ── 11. Audit action vocabulary ─────────────────────────────
/**
 * Canonical action strings for `RoyaltyAuditEvent.action`.
 * Keeping these in one place prevents typos in audit queries.
 */
export const ROYALTY_AUDIT_ACTIONS = {
  ENROL: "enrol",
  TERMS_ACCEPT: "terms_accept",
  DISABLE: "disable",
  CATEGORY_CHANGE: "category_change",
  PARTNER_APPROVE: "partner_approve",
  PARTNER_REJECT: "partner_reject",
  PAYOUT_ACCOUNT_CHANGE: "payout_account_change",
  PAYOUT_REQUEST: "payout_request",
  PAYOUT_APPROVE: "payout_approve",
  PAYOUT_PROCESS: "payout_process",
  PAYOUT_PAID: "payout_paid",
  PAYOUT_FAIL: "payout_fail",
  REVENUE_CONFIRM: "revenue_confirm",
  REVENUE_ESTIMATE: "revenue_estimate",
  REVENUE_REVERSE: "revenue_reverse",
  REVENUE_REJECT: "revenue_reject",
  DISPUTE_RAISE: "dispute",
  DISPUTE_RESOLVE: "dispute_resolve",
  LEDGER_STATUS_CHANGE: "ledger_status_change",
  WEBHOOK_RECEIVE: "webhook_receive",
  EXPORT: "export",
} as const;

export type RoyaltyAuditAction =
  (typeof ROYALTY_AUDIT_ACTIONS)[keyof typeof ROYALTY_AUDIT_ACTIONS];

// ── 12. Helper: is source type eligible? ────────────────────
export function isEligibleSourceType(sourceType: string): boolean {
  return (REVENUE_SOURCE_TYPES as readonly string[]).includes(sourceType);
}

export function isExcludedRevenueType(type: string): boolean {
  return (EXCLUDED_REVENUE_TYPES as readonly string[]).includes(type);
}

// ── 13. Helper: mask account reference for display ──────────
/**
 * Produce a masked display string for a payout account reference.
 * e.g. "acct_1234567890" → "****7890"
 *      "0712345678"      → "****5678"
 *      ""                → "****"
 */
export function maskAccountReference(reference: string): string {
  if (!reference) return "****";
  const clean = reference.replace(/\s+/g, "");
  if (clean.length <= 4) return `****${clean}`;
  return `****${clean.slice(-4)}`;
}

/**
 * MVP-only "encryption" — base64 encoding with a prefix marker.
 *
 * ⚠️  THIS IS NOT REAL ENCRYPTION. It only prevents casual
 * shoulder-surfing of account references in the database.
 * Production MUST replace this with AES-256-GCM using a key
 * stored in the platform's KMS / secrets manager.
 *
 * The `wewed:enc:v1:` prefix lets a future migration detect
 * which records use the legacy encoding.
 */
export function encodeAccountReferenceMVP(plain: string): string {
  return `wewed:enc:v1:${Buffer.from(plain, "utf-8").toString("base64")}`;
}

export function decodeAccountReferenceMVP(encoded: string): string {
  const prefix = "wewed:enc:v1:";
  if (!encoded.startsWith(prefix)) {
    // Legacy un-encoded value — return as-is.
    return encoded;
  }
  return Buffer.from(encoded.slice(prefix.length), "base64").toString("utf-8");
}
