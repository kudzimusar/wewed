import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-gate";
import { logAuditEvent } from "@/lib/audit";
import {
  ROYALTY_AUDIT_ACTIONS,
  MONETISATION_CATEGORIES,
} from "@/lib/royalty-engine";

/* ============================================================
   /api/royalty/preferences
   ------------------------------------------------------------
   • GET  ?slug=...
       List monetisation preferences for a wedding. Returns
       every category (even disabled ones) so the UI can
       render the full opt-in panel. Admin-gated.

   • PATCH { slug, category, enabled, placementRules?, actorId? }
       Upsert a monetisation preference. Records who approved
       the change and when. Admin-gated.

   Categories (per MONETISATION_CATEGORIES in royalty-engine):
     venue | vendors | travel | merchandise | advertising |
     clothing | memory_books | anniversary | referrals
   ============================================================ */

const FLAGSHIP_SLUG = "charity-and-kudzie";

// ─── GET /api/royalty/preferences ──────────────────────────
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

    const stored = await db.monetisationPreference.findMany({
      where: { weddingId: wedding.id },
      orderBy: { category: "asc" },
    });

    // Build a map for quick lookup, then ensure every category is
    // represented — even ones with no stored preference yet.
    const storedMap = new Map(stored.map((p) => [p.category, p]));
    const data = MONETISATION_CATEGORIES.map((category) => {
      const p = storedMap.get(category);
      return {
        id: p?.id ?? null,
        category,
        enabled: p?.enabled ?? false,
        placementRules: p?.placementRules ? safeParseJSON(p.placementRules) : null,
        approvedBy: p?.approvedBy ?? null,
        approvedAt: p?.approvedAt?.toISOString() ?? null,
        createdAt: p?.createdAt.toISOString() ?? null,
        updatedAt: p?.updatedAt?.toISOString() ?? null,
      };
    });

    const enabledCount = data.filter((d) => d.enabled).length;

    return NextResponse.json({
      success: true,
      count: data.length,
      enabledCount,
      data,
    });
  } catch (error) {
    console.error("[ROYALTY PREFERENCES GET] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch monetisation preferences" },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/royalty/preferences ────────────────────────
interface UpdatePreferencePayload {
  slug?: string;
  category?: string;
  enabled?: boolean;
  placementRules?: unknown;
  actorId?: string;
}

function safeParseJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export async function PATCH(request: NextRequest) {
  const adminBlock = requireAdmin(request);
  if (adminBlock) return adminBlock;

  try {
    const body = (await request.json()) as UpdatePreferencePayload;
    const slug = body.slug?.trim() || FLAGSHIP_SLUG;
    const category = body.category?.trim();
    const enabled = body.enabled;
    const actorId = body.actorId?.trim() || "admin";

    if (!category) {
      return NextResponse.json(
        { success: false, error: "category is required" },
        { status: 400 },
      );
    }
    if (!(MONETISATION_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid category: ${category}. Valid: ${MONETISATION_CATEGORIES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "enabled must be a boolean" },
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

    // placementRules is free-form JSON (e.g. ad slot positions).
    const placementRulesStr =
      body.placementRules !== undefined && body.placementRules !== null
        ? JSON.stringify(body.placementRules)
        : null;

    const preference = await db.$transaction(async (tx) => {
      // Fetch the "before" value for audit
      const before = await tx.monetisationPreference.findUnique({
        where: { weddingId_category: { weddingId: wedding.id, category } },
      });

      const p = await tx.monetisationPreference.upsert({
        where: { weddingId_category: { weddingId: wedding.id, category } },
        create: {
          weddingId: wedding.id,
          category,
          enabled,
          placementRules: placementRulesStr,
          approvedBy: actorId,
          approvedAt: new Date(),
        },
        update: {
          enabled,
          placementRules: placementRulesStr,
          approvedBy: actorId,
          approvedAt: new Date(),
        },
      });

      await tx.royaltyAuditEvent.create({
        data: {
          weddingId: wedding.id,
          action: ROYALTY_AUDIT_ACTIONS.CATEGORY_CHANGE,
          actorId,
          details: JSON.stringify({
            category,
            before: before
              ? { enabled: before.enabled, placementRules: before.placementRules }
              : null,
            after: { enabled, placementRules: placementRulesStr },
            preferenceId: p.id,
          }),
          ipAddress: request.headers.get("x-forwarded-for") ?? null,
        },
      });

      return { p, before };
    });

    await logAuditEvent({
      action: "royalty.preference.update",
      resourceType: "MonetisationPreference",
      resourceId: preference.p.id,
      beforeValue: preference.before
        ? { enabled: preference.before.enabled }
        : null,
      afterValue: { enabled, category },
      weddingId: wedding.id,
      actorId,
    });

    return NextResponse.json({
      success: true,
      preference: {
        id: preference.p.id,
        weddingId: preference.p.weddingId,
        category: preference.p.category,
        enabled: preference.p.enabled,
        placementRules: preference.p.placementRules
          ? safeParseJSON(preference.p.placementRules)
          : null,
        approvedBy: preference.p.approvedBy,
        approvedAt: preference.p.approvedAt?.toISOString() ?? null,
        updatedAt: preference.p.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[ROYALTY PREFERENCES PATCH] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update monetisation preference" },
      { status: 500 },
    );
  }
}
