import { db } from "@/lib/db";
import { isAdmin, requireAdmin } from "@/lib/admin-gate";
import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   /api/wedding-content
   ------------------------------------------------------------
   Multi-couple data-driven content layer.

   • GET  ?slug=charity-and-kudzie
          Public. Returns the wedding + couple + every content
          row for that slug, pre-shaped into a nested
          { [section]: { [field]: value } } object so the
          client can `getContent(content, "hero", "brideName")`
          without another transform.

   • POST  (admin-gated)
          Upsert a single content field for a wedding.
          Body: { slug, section, field, value, order?, metadata? }
          Idempotent via the @@unique([weddingId, section, field])
          constraint on WeddingContent.
   ============================================================ */

// ─── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const slug =
      request.nextUrl.searchParams.get("slug")?.trim() ||
      "charity-and-kudzie";

    const wedding = await db.wedding.findFirst({
      where: { slug },
      include: {
        couple: {
          select: {
            id: true,
            slug: true,
            partner1: true,
            partner2: true,
            surname: true,
            photo: true,
            subscriptionStatus: true,
          },
        },
        contentItems: true,
      },
    });

    if (!wedding) {
      return NextResponse.json(
        {
          success: false,
          error: `Wedding not found for slug "${slug}".`,
        },
        { status: 404 },
      );
    }

    // Shape the content rows into a nested { [section]: { [field]: value } } map.
    // For ordered items (field starts with `<prefix>-<n>`), the value is still
    // keyed under its field name — callers use getOrderedContent() to collect
    // them by prefix and sort by `order`.
    const content: Record<string, Record<string, string>> = {};
    const contentMeta: Record<string, Record<string, string | null>> = {};
    const ordered: Record<
      string,
      Array<{
        field: string;
        value: string;
        order: number;
        metadata: string | null;
      }>
    > = {};

    for (const row of wedding.contentItems) {
      if (!content[row.section]) content[row.section] = {};
      if (!contentMeta[row.section]) contentMeta[row.section] = {};
      content[row.section][row.field] = row.value;
      contentMeta[row.section][row.field] = row.metadata;

      // If the field looks like an ordered item (`prefix-N`), also collect
      // it into the ordered index for fast getOrderedContent() lookups.
      const m = /^([a-z]+)-(\d+)$/.exec(row.field);
      if (m) {
        const prefix = m[1];
        if (!ordered[row.section]) ordered[row.section] = [];
        ordered[row.section].push({
          field: row.field,
          value: row.value,
          order: row.order,
          metadata: row.metadata,
        });
      }
    }

    // Sort each ordered bucket by `order` (stable for ties by field name).
    for (const section of Object.keys(ordered)) {
      ordered[section].sort((a, b) =>
        a.order === b.order
          ? a.field.localeCompare(b.field, undefined, { numeric: true })
          : a.order - b.order,
      );
    }

    const publicData = {
      wedding: {
        id: wedding.id,
        slug: wedding.slug,
        title: wedding.title,
        monogram: wedding.monogram,
        tagline: wedding.tagline,
        date: wedding.date,
        venue: wedding.venue,
        venueCity: wedding.venueCity,
        venueCountry: wedding.venueCountry,
        venueMapUrl: wedding.venueMapUrl,
        lifecycle: wedding.lifecycle,
        privacy: wedding.privacy,
        canonSealed: wedding.canonSealed,
        subscriptionTier: wedding.subscriptionTier,
        // Theme config — data-driven so each couple can have their own palette
        theme: {
          primaryColor: wedding.primaryColor,
          accentColor: wedding.accentColor,
          memoryColor: wedding.memoryColor,
          backgroundColor: wedding.backgroundColor,
        },
        couple: wedding.couple,
      },
      content,
      // Auxiliary maps the client hook uses for ordered items + metadata.
      // Kept separate from `content` so the simple `getContent()` path stays
      // a one-liner for the 80% case.
      contentMeta,
      ordered,
    };

    return NextResponse.json({ success: true, data: publicData });
  } catch (error) {
    console.error("[WEDDING-CONTENT GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch wedding content." },
      { status: 500 },
    );
  }
}

// ─── POST (admin-gated) ──────────────────────────────────────

interface PostBody {
  slug?: string;
  section?: string;
  field?: string;
  value?: string;
  order?: number;
  metadata?: string | Record<string, unknown> | null;
}

export async function POST(request: NextRequest) {
  // Admin gate — couple-only writes. Reads are public (above).
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as PostBody | null;
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    const slug = body.slug?.trim();
    const section = body.section?.trim();
    const field = body.field?.trim();
    const value = typeof body.value === "string" ? body.value : "";

    if (!slug || !section || !field) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: slug, section, field.",
        },
        { status: 400 },
      );
    }

    const wedding = await db.wedding.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!wedding) {
      return NextResponse.json(
        { success: false, error: `Wedding not found for slug "${slug}".` },
        { status: 404 },
      );
    }

    // Normalise metadata to a JSON string (or null). Accept either a
    // pre-serialised string or a raw object from the client.
    let metadata: string | null = null;
    if (body.metadata != null) {
      if (typeof body.metadata === "string") {
        metadata = body.metadata;
      } else {
        try {
          metadata = JSON.stringify(body.metadata);
        } catch {
          metadata = null;
        }
      }
    }

    const order =
      typeof body.order === "number" && Number.isFinite(body.order)
        ? Math.max(0, Math.floor(body.order))
        : 0;

    await db.weddingContent.upsert({
      where: {
        weddingId_section_field: {
          weddingId: wedding.id,
          section,
          field,
        },
      },
      update: {
        value,
        order,
        metadata,
      },
      create: {
        weddingId: wedding.id,
        section,
        field,
        value,
        order,
        metadata,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WEDDING-CONTENT POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save wedding content." },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";

// `isAdmin` is imported alongside `requireAdmin` so the canonical
// helper remains the single source of truth for the gate. We touch
// it once here to keep the import live without affecting runtime.
void isAdmin;
