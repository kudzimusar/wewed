import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-gate";
import {
  buildFlagshipContent,
  FLAGSHIP_WEDDING_SLUG,
} from "@/lib/wedding-content-seed";
import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   /api/wedding-content/seed
   ------------------------------------------------------------
   POST (admin-gated) — seeds ALL of Charity & Kudzie's
   hardcoded content into the WeddingContent table.

   Idempotent: every row is upserted on the
   @@unique([weddingId, section, field]) constraint, so
   re-running the endpoint after edits will overwrite the
   seeded defaults with the canonical text but won't create
   duplicates. (For couple-edited content, the couple should
   use POST /api/wedding-content instead — this endpoint is
   for resetting / initialising the canonical baseline.)

   Returns: { success: true, count: N, wedding: { slug, id } }
   ============================================================ */

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const wedding = await db.wedding.findFirst({
      where: { slug: FLAGSHIP_WEDDING_SLUG },
      select: { id: true, slug: true },
    });

    if (!wedding) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Flagship wedding not found. Run POST /api/seed first to create the Wedding + Couple rows.",
        },
        { status: 404 },
      );
    }

    const seedRows = buildFlagshipContent();

    // Upsert each row in parallel batches. SQLite handles the
    // unique constraint atomically; we batch by 25 to keep
    // transaction sizes reasonable for the ~70-row flagship set.
    const BATCH_SIZE = 25;
    let upserted = 0;
    for (let i = 0; i < seedRows.length; i += BATCH_SIZE) {
      const batch = seedRows.slice(i, i + BATCH_SIZE);
      await db.$transaction(
        batch.map((row) =>
          db.weddingContent.upsert({
            where: {
              weddingId_section_field: {
                weddingId: wedding.id,
                section: row.section,
                field: row.field,
              },
            },
            update: {
              value: row.value,
              order: row.order ?? 0,
              metadata: row.metadata ?? null,
            },
            create: {
              weddingId: wedding.id,
              section: row.section,
              field: row.field,
              value: row.value,
              order: row.order ?? 0,
              metadata: row.metadata ?? null,
            },
          }),
        ),
      );
      upserted += batch.length;
    }

    // Sanity: count total rows for this wedding in the DB.
    const totalInDb = await db.weddingContent.count({
      where: { weddingId: wedding.id },
    });

    return NextResponse.json({
      success: true,
      count: upserted,
      total: totalInDb,
      wedding: { slug: wedding.slug, id: wedding.id },
    });
  } catch (error) {
    console.error("[WEDDING-CONTENT/SEED POST] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed wedding content.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
