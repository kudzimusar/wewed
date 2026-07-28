import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  buildWeddingContent,
  buildDefaultTasks,
  buildDefaultBudgetItems,
  buildDefaultTimeline,
  buildDefaultSeatingTables,
} from "@/lib/wedding-content-seed";

/* ============================================================
   /api/onboarding
   ------------------------------------------------------------
   POST — public registration flow for a brand-new couple.

   Creates:
     1. Couple            (slug, partner1, partner2, surname)
     2. User              (email + scrypt-hashed password,
                           role "couple", linked to the couple)
     3. Wedding           (slug, default theme palette,
                           lifecycle "before", subscriptionTier "free")
     4. WeddingContent    (~70 rows: hero, story, venue, theday,
                           travel, faq, songbook, guests — templated
                           with the new couple's names/date/venue)
     5. PlannerTask[]     (~100 default checklist items, alternating
                           assignee between partner1 & partner2)
     6. BudgetItem[]      (14 default line items)
     7. ProgrammeItem[]   (11 default day-of timeline blocks)
     8. SeatingTable[]    (8 default tables)

   Returns: { success: true, slug, url: "/?wedding=slug" }

   No admin gate — this IS the registration flow. All writes
   are scoped to the newly-created couple + wedding.
   ============================================================ */

// ─── password hashing (node crypto, no external deps) ─────────

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

// Re-exported for a future /api/auth route to verify against.
// Not used here, but kept so the verifier lives next to the hasher.
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const test = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (test.length !== expected.length) return false;
  return timingSafeEqual(test, expected);
}

// ─── slug generation ──────────────────────────────────────────

/** Strip to a-z0-9, spaces → single hyphen. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** "Sarah" + "David" → "sarah-and-david". */
function buildSlug(partner1: string, partner2: string): string {
  const a = slugify(partner1);
  const b = slugify(partner2);
  if (!a || !b) return "";
  return `${a}-and-${b}`;
}

/** Append -2, -3, … until the slug is unique across both Couple & Wedding. */
async function ensureUniqueSlug(base: string): Promise<string> {
  if (!base) return "";
  let candidate = base;
  let suffix = 1;
  // Loop until neither Couple.slug nor Wedding.slug matches.
  while (true) {
    const [coupleHit, weddingHit] = await Promise.all([
      db.couple.findFirst({ where: { slug: candidate }, select: { id: true } }),
      db.wedding.findFirst({ where: { slug: candidate }, select: { id: true } }),
    ]);
    if (!coupleHit && !weddingHit) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

// ─── validation ───────────────────────────────────────────────

interface OnboardingBody {
  partner1?: string;
  partner2?: string;
  surname?: string;
  weddingDate?: string;
  venue?: string;
  venueCity?: string;
  venueCountry?: string;
  email?: string;
  password?: string;
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    memoryColor?: string;
    backgroundColor?: string;
  };
}

interface FieldIssue {
  field: string;
  message: string;
}

function validate(body: OnboardingBody): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!body.partner1 || body.partner1.trim().length < 2)
    issues.push({ field: "partner1", message: "Partner 1 name is required." });
  if (!body.partner2 || body.partner2.trim().length < 2)
    issues.push({ field: "partner2", message: "Partner 2 name is required." });
  if (!body.weddingDate || Number.isNaN(new Date(body.weddingDate).getTime()))
    issues.push({ field: "weddingDate", message: "A valid wedding date is required." });
  if (!body.venue || body.venue.trim().length < 2)
    issues.push({ field: "venue", message: "Venue is required." });
  if (!body.venueCity || body.venueCity.trim().length < 2)
    issues.push({ field: "venueCity", message: "Venue city is required." });
  if (!body.venueCountry || body.venueCountry.trim().length < 2)
    issues.push({ field: "venueCountry", message: "Venue country is required." });
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
    issues.push({ field: "email", message: "A valid email is required." });
  if (!body.password || body.password.length < 8)
    issues.push({
      field: "password",
      message: "Password must be at least 8 characters.",
    });
  return issues;
}

// ─── POST handler ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as OnboardingBody | null;
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    const issues = validate(body);
    if (issues.length > 0) {
      return NextResponse.json(
        { success: false, error: "Validation failed.", issues },
        { status: 400 },
      );
    }

    const partner1 = body.partner1!.trim();
    const partner2 = body.partner2!.trim();
    const surname = body.surname?.trim() || null;
    const weddingDate = new Date(body.weddingDate!);
    const venue = body.venue!.trim();
    const venueCity = body.venueCity!.trim();
    const venueCountry = body.venueCountry!.trim();
    const email = body.email!.trim().toLowerCase();
    const theme = body.theme ?? {};

    // ── 1. Email uniqueness check ───────────────────────────────
    const existingUser = await db.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "An account already exists with this email.",
          issues: [{ field: "email", message: "Email already registered." }],
        },
        { status: 409 },
      );
    }

    // ── 2. Generate unique slug from partner names ──────────────
    const baseSlug = buildSlug(partner1, partner2);
    if (!baseSlug) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not generate a slug from the partner names.",
        },
        { status: 400 },
      );
    }
    const slug = await ensureUniqueSlug(baseSlug);

    // ── 3. Create Couple + User + Wedding in one transaction ────
    // Doing the three "anchor" rows transactionally so a partial
    // failure (e.g. email race) can't leave an orphan couple.
    const created = await db.$transaction(async (tx) => {
      const couple = await tx.couple.create({
        data: {
          slug,
          partner1,
          partner2,
          surname,
          subscriptionStatus: "free",
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          name: `${partner1} & ${partner2}`,
          role: "couple",
          coupleId: couple.id,
          passwordHash: hashPassword(body.password!),
          isActive: true,
        },
      });

      const wedding = await tx.wedding.create({
        data: {
          slug,
          title: `${partner1} & ${partner2}`,
          monogram: `${(partner1[0] ?? "?").toUpperCase()}&${(partner2[0] ?? "?").toUpperCase()}`,
          tagline: `${weddingDate.getDate()}.${String(weddingDate.getMonth() + 1).padStart(2, "0")}.${String(weddingDate.getFullYear()).slice(-2)}`,
          date: weddingDate,
          venue,
          venueCity,
          venueCountry,
          primaryColor: theme.primaryColor ?? "#BF9B5F",
          accentColor: theme.accentColor ?? "#C0633F",
          memoryColor: theme.memoryColor ?? "#6B2D3A",
          backgroundColor: theme.backgroundColor ?? "#FBF6EE",
          lifecycle: "before",
          privacy: "public",
          canonSealed: false,
          subscriptionTier: "free",
          coupleId: couple.id,
        },
      });

      return { couple, user, wedding };
    });

    // ── 4. Seed WeddingContent (parallel batches of 25) ────────
    const contentRows = buildWeddingContent({
      brideName: partner1,
      groomName: partner2,
      surname: surname ?? undefined,
      weddingDate,
      venue,
      venueCity,
      venueCountry,
    });

    const CONTENT_BATCH = 25;
    let contentCount = 0;
    for (let i = 0; i < contentRows.length; i += CONTENT_BATCH) {
      const batch = contentRows.slice(i, i + CONTENT_BATCH);
      await db.$transaction(
        batch.map((row) =>
          db.weddingContent.create({
            data: {
              weddingId: created.wedding.id,
              section: row.section,
              field: row.field,
              value: row.value,
              order: row.order ?? 0,
              metadata: row.metadata ?? null,
            },
          }),
        ),
      );
      contentCount += batch.length;
    }

    // ── 5. Seed default planner tasks (~110) ───────────────────
    const tasks = buildDefaultTasks(partner1, partner2);
    const TASK_BATCH = 50;
    let taskCount = 0;
    for (let i = 0; i < tasks.length; i += TASK_BATCH) {
      const batch = tasks.slice(i, i + TASK_BATCH);
      await db.$transaction(
        batch.map((t, idx) =>
          db.plannerTask.create({
            data: {
              weddingId: created.wedding.id,
              title: t.title,
              description: t.description,
              category: t.category,
              status: t.status,
              priority: t.priority,
              assignee: t.assignee,
              order: i + idx,
            },
          }),
        ),
      );
      taskCount += batch.length;
    }

    // ── 6. Seed default budget items (14) ──────────────────────
    const budget = buildDefaultBudgetItems();
    await db.$transaction(
      budget.map((b) =>
        db.budgetItem.create({
          data: {
            weddingId: created.wedding.id,
            category: b.category,
            description: b.description,
            estimatedCost: b.estimatedCost,
            actualCost: b.actualCost,
            paidAmount: b.paidAmount,
            currency: b.currency,
          },
        }),
      ),
    );

    // ── 7. Seed default day-of timeline (ProgrammeItem, 11) ────
    const timeline = buildDefaultTimeline(venue);
    await db.$transaction(
      timeline.map((t, idx) =>
        db.programmeItem.create({
          data: {
            weddingId: created.wedding.id,
            time: t.time,
            title: t.event,
            description: t.notes,
            icon: null,
            order: idx,
          },
        }),
      ),
    );

    // ── 8. Seed default seating tables (8) ─────────────────────
    const tables = buildDefaultSeatingTables();
    await db.$transaction(
      tables.map((t) =>
        db.seatingTable.create({
          data: {
            weddingId: created.wedding.id,
            name: t.name,
            capacity: t.capacity,
          },
        }),
      ),
    );

    return NextResponse.json(
      {
        success: true,
        slug,
        url: `/?wedding=${slug}`,
        wedding: {
          id: created.wedding.id,
          slug: created.wedding.slug,
          title: created.wedding.title,
        },
        couple: {
          id: created.couple.id,
          slug: created.couple.slug,
        },
        seeded: {
          content: contentCount,
          tasks: taskCount,
          budget: budget.length,
          timeline: timeline.length,
          tables: tables.length,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[ONBOARDING POST] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to onboard new couple.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
