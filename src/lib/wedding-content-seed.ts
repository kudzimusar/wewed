/**
 * wedding-content-seed.ts
 * ------------------------------------------------------------
 * Shared, framework-agnostic builders for the WeddingContent
 * rows that drive the multi-couple data layer.
 *
 * Used by:
 *   • /api/wedding-content/seed/route.ts   — seeds the flagship
 *     Charity & Kudzie wedding content.
 *   • /api/onboarding/route.ts             — copies the same
 *     structure for a brand-new couple, templated with their
 *     names / date / venue.
 *
 * Design notes:
 *   - Every row is plain JSON-serialisable so it can be passed
 *     straight to `db.weddingContent.upsert(...)`.
 *   - Ordered items (milestones, programme, features, faq, cards)
 *     use a `field` of the form `<prefix>-<index>` with the
 *     primary display text in `value` and structured sub-fields
 *     (icon, body, time, description, highlight, etc.) in the
 *     `metadata` JSON string. This lets `getOrderedContent()`
 *     fetch all items for a prefix in one pass and sort by
 *     `order`.
 *   - Single-value fields (headings, tagline, monogram, etc.)
 *     leave `metadata` null.
 */

export const FLAGSHIP_WEDDING_SLUG = "charity-and-kudzie";

export interface WeddingContentSeed {
  section: string;
  field: string;
  value: string;
  order?: number;
  metadata?: string; // JSON string
}

interface ContentTemplateOpts {
  brideName: string;
  groomName: string;
  surname?: string;
  /** ISO date string or Date for the wedding date */
  weddingDate: string | Date;
  venue: string;
  venueCity: string;
  venueCountry: string;
}

// ─── helpers ──────────────────────────────────────────────────

function meta(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

/** Format a Date as "DD · MM · YY" for the hero date pill. */
function formatHeroDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd} · ${mm} · ${yy}`;
}

/** Format a Date as "C&K · DD.MM.YY" for the monogram badge. */
function formatMonogram(
  bride: string,
  groom: string,
  d: Date,
): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const a = (bride[0] ?? "").toUpperCase();
  const b = (groom[0] ?? "").toUpperCase();
  return `${a}&${b} · ${dd}.${mm}.${yy}`;
}

/** Format a Date as "Weekday, Month DD, YYYY · Venue, City". */
function formatDateLine(d: Date, venue: string, city: string): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${weekday}, ${month} ${day}, ${year} · ${venue}, ${city}`;
}

/** Convert a Date to the local date used for the wedding. */
function asDate(d: string | Date): Date {
  return d instanceof Date ? d : new Date(d);
}

// ─── the 5 story milestones ───────────────────────────────────

const STORY_MILESTONES: Array<{ title: string; body: string; icon: string }> = [
  {
    title: "When Two Worlds Met",
    body: "Some stories begin with a glance across a crowded room. Others begin with a quiet certainty — the kind that settles in your bones before you even know its name. Charity and Kudzie met in the way all great love stories begin: unexpectedly, inevitably, as though the universe had been plotting this moment since before time began.",
    icon: "✦",
  },
  {
    title: "The First Dance",
    body: "Their early days were filled with the kind of laughter that makes your sides ache and the comfortable silences that only happen between two people who have found their home in each other. Every date felt like unwrapping a gift they didn't know they needed. Harare's golden sunsets became their backdrop, and its warm evenings their witness.",
    icon: "✦",
  },
  {
    title: "Growing Together",
    body: "Love deepened into family. Norioshona arrived with his mother's fire and his father's quiet strength — a boy who lights up every room. Then came Narasora, their daughter, carrying the best of both of them in her smile. Together, the four of them built a life rooted in faith, laughter, and the kind of love that doesn't just endure — it expands.",
    icon: "✦",
  },
  {
    title: "The Question",
    body: "When Kudzie asked Charity to be his wife, it wasn't a question at all — it was a promise already written in the stars. On bended knee, with the Zimbabwean sky stretching endlessly above them, he offered her not just a ring but a forever. And she, who had already given him her heart, said yes before the words had fully left his lips.",
    icon: "✦",
  },
  {
    title: "Forever Begins",
    body: "And so the countdown began — not to an end, but to a beginning. On December 23, 2026, beneath the baobabs and the wide African sky, Charity and Kudzie will stand before the people they love most and promise what their hearts have known all along: that this love is for keeps. Forever begins at Imba Manor.",
    icon: "✦",
  },
];

// ─── the 11 programme items ───────────────────────────────────

const PROGRAMME_ITEMS: Array<{
  time: string;
  title: string;
  description: string;
  highlight: boolean;
}> = [
  { time: "13:00", title: "Guests Arrive", description: "Welcome drinks & mingling", highlight: false },
  { time: "14:00", title: "Ceremony Begins", description: "The procession starts", highlight: false },
  { time: "14:45", title: '"I Do" — The Vows', description: "The moment we say forever", highlight: true },
  { time: "15:00", title: "Confetti & Celebrations", description: "Joy, tears & photographs", highlight: false },
  { time: "15:30", title: "Cocktail Hour & Canapés", description: "Sip, savour & celebrate", highlight: false },
  { time: "16:30", title: "Reception & First Dance", description: "Mr & Mrs Musarurwa take the floor", highlight: false },
  { time: "17:00", title: "Dinner is Served", description: "A feast to remember", highlight: false },
  { time: "18:30", title: "Speeches & Toasts", description: "Words from the heart", highlight: false },
  { time: "19:30", title: "Cutting the Cake", description: "Sweet beginnings", highlight: false },
  { time: "20:00", title: "Dance Floor Opens", description: "Let the celebration begin!", highlight: false },
  { time: "22:00", title: "Last Dance & Sparkler Exit", description: "A magical farewell", highlight: true },
];

// ─── venue features + moments ─────────────────────────────────

const VENUE_FEATURES: string[] = [
  "Ceremony garden with capacity for 200 guests",
  "Grand reception hall with crystal chandeliers",
  "Manicured lawns for outdoor cocktail hour",
  "On-site catering with Zimbabwean & international cuisine",
  "Complimentary valet parking",
  "Bridal suite with full preparation facilities",
];

const VENUE_MOMENTS: Array<{ label: string; icon: string }> = [
  { label: "Garden Ceremony", icon: "Flower2" },
  { label: "Cocktail Hour", icon: "Wine" },
  { label: "Grand Reception", icon: "Sparkles" },
  { label: "Sparkler Exit", icon: "Star" },
];

const VENUE_DESCRIPTION =
  "Nestled in the heart of Harare's verdant Borrowdale suburb, Imba Manor is an exclusive estate that blends colonial elegance with African warmth. Its manicured gardens, sweeping lawns, and timeless architecture provide the perfect canvas for a celebration of love. The name 'Imba' means home in Shona — and on December 23, 2026, this place will become the home of our forever.";

// ─── travel cards ─────────────────────────────────────────────

interface TravelHotel {
  name: string;
  stars: string;
  location: string;
  price: string;
}
interface TravelTip {
  label: string;
  color: string;
  text: string;
}

const TRAVEL_HOTELS: TravelHotel[] = [
  { name: "Meikles Hotel", stars: "5-star", location: "City center", price: "$180" },
  { name: "Rainbow Towers Hotel", stars: "4-star", location: "Central Harare", price: "$120" },
  { name: "Crowne Plaza Harare", stars: "4-star", location: "Borrowdale area", price: "$140" },
  { name: "Airbnbs in Borrowdale", stars: "Self-catering", location: "Borrowdale area", price: "$60" },
];

const TRAVEL_TIPS: TravelTip[] = [
  {
    label: "Dress Code",
    color: "clay",
    text: "Formal / Black Tie Optional — Traditional Zimbabwean attire warmly welcomed.",
  },
  {
    label: "Weather",
    color: "gold",
    text: "December in Harare is warm (25–30°C / 77–86°F) with possible afternoon showers. Light layers recommended.",
  },
  {
    label: "Gifts",
    color: "sage",
    text: "Your presence is our greatest gift. A registry link will be shared soon.",
  },
  {
    label: "Cultural Note",
    color: "plum",
    text: "In Shona tradition, it is customary to bring a small gift for the families. This is entirely optional — your presence is what matters most.",
  },
];

// ─── FAQ items ────────────────────────────────────────────────

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: "What time should I arrive?",
    answer:
      "Guests should arrive by 13:00 to allow time for parking and seating. The ceremony begins promptly at 14:00.",
  },
  {
    question: "Is there parking at Imba Manor?",
    answer: "Yes, complimentary valet parking is available at the venue. Follow the signs upon arrival.",
  },
  {
    question: "Can I bring my children?",
    answer:
      "Children are most welcome! Charity and Kudzie's own little ones, Norioshona and Narasora, will be there. Please indicate the number of children on your RSVP.",
  },
  {
    question: "What should I wear?",
    answer:
      "Formal or Black Tie Optional. Traditional Zimbabwean attire is warmly welcomed. We kindly ask guests to avoid white and ivory — those shades are reserved for the bride.",
  },
  {
    question: "Will there be vegetarian/vegan options?",
    answer:
      "Yes, please indicate your dietary preference on your RSVP. We'll have beef, chicken, vegetarian, vegan, and traditional Zimbabwean options.",
  },
  {
    question: "Can I take photos during the ceremony?",
    answer:
      "We're having an unplugged ceremony — please keep phones and cameras away during the vows. Our photographer will capture every moment, and you'll see all the photos in the gallery afterward. Feel free to snap away during the reception!",
  },
  {
    question: "Is there a gift registry?",
    answer:
      "Your presence is our greatest gift. For those who wish, a contribution to our honeymoon fund or a donation to the Musarurwa Family Foundation would be deeply appreciated. See the Registry section below.",
  },
  {
    question: "What if I have a food allergy?",
    answer:
      "Please note any allergies in the dietary requirements field on your RSVP, and speak to our coordinator on the day. We want everyone to enjoy the feast safely.",
  },
];

// ─── builder ──────────────────────────────────────────────────

/**
 * Build the full WeddingContent seed array for a couple.
 * Used by both the flagship seed endpoint (with Charity & Kudzie's
 * values) and the onboarding endpoint (with a new couple's values).
 */
export function buildWeddingContent(opts: ContentTemplateOpts): WeddingContentSeed[] {
  const d = asDate(opts.weddingDate);
  const bride = opts.brideName;
  const groom = opts.groomName;
  const surname = opts.surname?.trim() || "";
  const venueFull = `${opts.venue} · ${opts.venueCity}, ${opts.venueCountry}`;
  const tagline = surname ? `Mr & Mrs ${surname}` : `${bride} & ${groom}`;
  const familyName = surname ? `The ${surname} Family` : `${bride} & ${groom}`;

  const rows: WeddingContentSeed[] = [];

  // ── hero ────────────────────────────────────────────────────
  rows.push({ section: "hero", field: "brideName", value: bride });
  rows.push({ section: "hero", field: "groomName", value: groom });
  rows.push({ section: "hero", field: "date", value: formatHeroDate(d) });
  rows.push({ section: "hero", field: "venue", value: venueFull });
  rows.push({ section: "hero", field: "tagline", value: tagline });
  rows.push({ section: "hero", field: "monogram", value: formatMonogram(bride, groom, d) });

  // ── story ───────────────────────────────────────────────────
  rows.push({ section: "story", field: "heading", value: "Our Story" });
  rows.push({
    section: "story",
    field: "subtitle",
    value: "A love written in the stars, lived under African skies",
  });
  STORY_MILESTONES.forEach((m, i) => {
    rows.push({
      section: "story",
      field: `milestone-${i}`,
      value: m.title,
      order: i,
      metadata: meta({ icon: m.icon, body: m.body }),
    });
  });
  rows.push({ section: "story", field: "familyTitle", value: familyName, order: 100 });
  rows.push({
    section: "story",
    field: "familyNames",
    value: `${bride} & ${groom} · Norioshona · Narasora`,
    order: 101,
  });

  // ── venue ───────────────────────────────────────────────────
  rows.push({ section: "venue", field: "heading", value: opts.venue });
  rows.push({
    section: "venue",
    field: "subtitle",
    value: "Our chosen sanctuary — where forever begins",
  });
  rows.push({ section: "venue", field: "description", value: VENUE_DESCRIPTION });
  VENUE_FEATURES.forEach((f, i) => {
    rows.push({ section: "venue", field: `feature-${i}`, value: f, order: i });
  });
  VENUE_MOMENTS.forEach((m, i) => {
    rows.push({
      section: "venue",
      field: `moment-${i}`,
      value: m.label,
      order: 100 + i,
      metadata: meta({ icon: m.icon }),
    });
  });

  // ── theday ──────────────────────────────────────────────────
  rows.push({ section: "theday", field: "heading", value: "The Day" });
  rows.push({
    section: "theday",
    field: "dateLine",
    value: formatDateLine(d, opts.venue, opts.venueCity),
  });
  rows.push({ section: "theday", field: "venueName", value: opts.venue });
  rows.push({
    section: "theday",
    field: "venueLocation",
    value: `${opts.venueCity}, ${opts.venueCountry}`,
  });
  rows.push({
    section: "theday",
    field: "venueDescription",
    value:
      "An exclusive venue nestled in the heart of Harare, offering timeless elegance and breathtaking views for your most cherished moments.",
  });
  rows.push({
    section: "theday",
    field: "dressCode",
    value: "Formal / Black Tie Optional",
  });
  rows.push({
    section: "theday",
    field: "dressCodeNote",
    value:
      "We kindly ask guests to avoid white and ivory — those shades are reserved for the bride.",
  });
  PROGRAMME_ITEMS.forEach((p, i) => {
    rows.push({
      section: "theday",
      field: `programme-${i}`,
      value: p.title,
      order: i,
      metadata: meta({
        time: p.time,
        description: p.description,
        highlight: p.highlight,
      }),
    });
  });

  // ── travel ──────────────────────────────────────────────────
  rows.push({ section: "travel", field: "heading", value: "Travel & Stay" });
  rows.push({
    section: "travel",
    field: "subtitle",
    value: `Everything you need to plan your journey to ${opts.venue}.`,
  });
  rows.push({
    section: "travel",
    field: "card-0",
    value: "Getting There",
    order: 0,
    metadata: meta({
      icon: "MapPin",
      venue: opts.venue,
      location: `${opts.venueCity}, ${opts.venueCountry}`,
      directions: `From ${opts.venueCity} city center, head northeast on Samora Machel Ave, then follow signs to Borrowdale. ${opts.venue} is approximately 20 minutes from the center.`,
      airport: "Robert Gabriel Mugabe International Airport (HRE)",
      airportNote: `20 min drive to ${opts.venue}`,
      shuttle: "Complimentary Shuttle",
      shuttleNote: "From Meikles Hotel at 12:30 on the day",
    }),
  });
  rows.push({
    section: "travel",
    field: "card-1",
    value: "Where to Stay",
    order: 1,
    metadata: meta({
      icon: "Hotel",
      hotels: TRAVEL_HOTELS,
      note: "Prices are approximate and may vary by season.",
    }),
  });
  rows.push({
    section: "travel",
    field: "card-2",
    value: "What to Know",
    order: 2,
    metadata: meta({ icon: "Info", tips: TRAVEL_TIPS }),
  });

  // ── faq ─────────────────────────────────────────────────────
  rows.push({ section: "faq", field: "heading", value: "Questions & Answers" });
  rows.push({
    section: "faq",
    field: "subtitle",
    value: "Everything you might be wondering about the day",
  });
  FAQ_ITEMS.forEach((item, i) => {
    rows.push({
      section: "faq",
      field: `item-${i}`,
      value: item.question,
      order: i,
      metadata: meta({ answer: item.answer }),
    });
  });

  // ── songbook ────────────────────────────────────────────────
  rows.push({ section: "songbook", field: "heading", value: "Songbook" });
  rows.push({
    section: "songbook",
    field: "subtitle",
    value: "Curated by the couple, requested by guests",
  });
  rows.push({
    section: "songbook",
    field: "ceremonyHeading",
    value: "Ceremony",
  });
  rows.push({
    section: "songbook",
    field: "receptionHeading",
    value: "Reception",
  });
  rows.push({
    section: "songbook",
    field: "firstDanceHeading",
    value: "First Dance",
  });

  // ── guests ──────────────────────────────────────────────────
  rows.push({ section: "guests", field: "heading", value: "Meet the Village" });
  rows.push({
    section: "guests",
    field: "subtitle",
    value: "The people who make our story complete",
  });
  rows.push({
    section: "guests",
    field: "bridalPartyHeading",
    value: "Bridal Party",
  });
  rows.push({
    section: "guests",
    field: "familyHeading",
    value: "Family",
  });

  return rows;
}

/**
 * Convenience: the flagship content for Charity & Kudzie.
 */
export function buildFlagshipContent(): WeddingContentSeed[] {
  return buildWeddingContent({
    brideName: "Charity",
    groomName: "Kudzie",
    surname: "Musarurwa",
    weddingDate: new Date("2026-12-23T14:00:00Z"),
    venue: "Imba Manor",
    venueCity: "Harare",
    venueCountry: "Zimbabwe",
  });
}

// ============================================================
//  Default planner seed (used by /api/onboarding)
//  Generic, couple-templated versions of the SEED_TASKS /
//  SEED_BUDGET / SEED_TIMELINE / SEED_TABLES in the planner
//  component, so a brand-new couple starts with a sensible
//  starter set instead of an empty dashboard.
// ============================================================

export interface DefaultTask {
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  assignee: string;
}

export interface DefaultBudgetItem {
  category: string;
  description: string;
  estimatedCost: number;
  actualCost: number | null;
  paidAmount: number;
  currency: string;
}

export interface DefaultTimelineBlock {
  time: string;
  event: string;
  duration: string;
  location: string;
  notes: string;
}

export interface DefaultSeatingTable {
  name: string;
  capacity: number;
}

/**
 * Build the default planner task list for a new couple.
 * Returns ~110 generic wedding-planning tasks, alternating
 * the assignee between partner1 and partner2 (the original
 * Charity & Kudzie list assigned specific tasks by name).
 */
export function buildDefaultTasks(partner1: string, partner2: string): DefaultTask[] {
  const P1 = partner1;
  const P2 = partner2;
  // Helper for alternating assignees — keeps the list readable.
  const alt = (i: number): string => (i % 2 === 0 ? P1 : P2);

  const raw: Array<Omit<DefaultTask, "assignee">> = [
    // 12–18 months before
    { title: "Set your wedding date", description: "Confirm and lock in the wedding date", category: "timeline_12_18", status: "todo", priority: "high" },
    { title: "Establish your wedding budget", description: "Determine total budget and allocate per category", category: "timeline_12_18", status: "todo", priority: "high" },
    { title: "Create a guest list estimate", description: "Draft initial guest count for venue planning", category: "timeline_12_18", status: "todo", priority: "high" },
    { title: "Choose your wedding theme and style", description: "Colors, mood, aesthetic direction", category: "timeline_12_18", status: "todo", priority: "medium" },
    { title: "Book your venue", description: "Confirm ceremony + reception venue", category: "timeline_12_18", status: "todo", priority: "high" },
    { title: "Hire a wedding planner/coordinator (if required)", description: "Optional — for day-of coordination", category: "timeline_12_18", status: "todo", priority: "medium" },
    { title: "Choose your bridal party", description: "Confirm bridesmaids, groomsmen, maid of honor, best man", category: "timeline_12_18", status: "todo", priority: "high" },
    { title: "Start researching vendors", description: "Photographer, caterer, florist, DJ, etc.", category: "timeline_12_18", status: "todo", priority: "high" },
    // 9–12 months before
    { title: "Book photographer and videographer", description: "Full-day coverage + cinematic reel", category: "timeline_9_12", status: "todo", priority: "high" },
    { title: "Book caterer", description: "Menu tasting + confirm date", category: "timeline_9_12", status: "todo", priority: "high" },
    { title: "Book décor and floral team", description: "Bouquets, centerpieces, ceremony arch", category: "timeline_9_12", status: "todo", priority: "high" },
    { title: "Book DJ, MC, or live band", description: "Reception entertainment + MC", category: "timeline_9_12", status: "todo", priority: "high" },
    { title: "Choose wedding colors", description: "Pick your palette", category: "timeline_9_12", status: "todo", priority: "medium" },
    { title: "Start shopping for your wedding dress", description: "Begin fittings and alterations", category: "timeline_9_12", status: "todo", priority: "high" },
    { title: "Book hair and makeup artist", description: "Bride + bridal party hair/makeup", category: "timeline_9_12", status: "todo", priority: "high" },
    { title: "Arrange accommodation for out-of-town guests", description: "Hotel block booking", category: "timeline_9_12", status: "todo", priority: "medium" },
    { title: "Start premarital counseling", description: "Church/marriage counseling sessions", category: "timeline_9_12", status: "todo", priority: "high" },
    // 6–9 months before
    { title: "Finalize guest list", description: "Lock in final guest count", category: "timeline_6_9", status: "todo", priority: "high" },
    { title: "Send Save-the-Date notices", description: "Email + physical save-the-dates", category: "timeline_6_9", status: "todo", priority: "medium" },
    { title: "Choose bridesmaids dresses", description: "Coordinate palette and styles", category: "timeline_6_9", status: "todo", priority: "medium" },
    { title: "Select groom attire", description: "Tailored suit + shirt + shoes", category: "timeline_6_9", status: "todo", priority: "medium" },
    { title: "Book transportation if needed", description: "Shuttle for guests + bridal car", category: "timeline_6_9", status: "todo", priority: "medium" },
    { title: "Plan honeymoon", description: "Decide destination, book flights + hotels", category: "timeline_6_9", status: "todo", priority: "medium" },
    { title: "Begin wedding registry", description: "Register at a homeware store", category: "timeline_6_9", status: "todo", priority: "low" },
    { title: "Meet with caterer for menu tasting", description: "Confirm beef, chicken, veg, traditional options", category: "timeline_6_9", status: "todo", priority: "medium" },
    // 3–6 months before
    { title: "Order wedding cake", description: "Three-tier, traditional + fruit option", category: "timeline_3_6", status: "todo", priority: "medium" },
    { title: "Confirm décor and floral designs", description: "Finalize centerpieces + ceremony arch", category: "timeline_3_6", status: "todo", priority: "medium" },
    { title: "Choose wedding favors", description: "Gifts for guests at reception", category: "timeline_3_6", status: "todo", priority: "low" },
    { title: "Purchase wedding rings", description: "Bands for both partners", category: "timeline_3_6", status: "todo", priority: "high" },
    { title: "Plan ceremony details", description: "Order of service, processional, recessional", category: "timeline_3_6", status: "todo", priority: "high" },
    { title: "Choose scripture readings, vows, and songs", description: "Ceremony music + readings", category: "timeline_3_6", status: "todo", priority: "high" },
    { title: "Schedule dress fittings", description: "Multiple fittings for alterations", category: "timeline_3_6", status: "todo", priority: "medium" },
    { title: "Purchase bridal accessories", description: "Veil, shoes, jewelry, perfume", category: "timeline_3_6", status: "todo", priority: "medium" },
    { title: "Prepare seating plan draft", description: "Initial table assignments", category: "timeline_3_6", status: "todo", priority: "medium" },
    // 2 months before
    { title: "Send invitations", description: "Gold foil invitations with RSVP cards", category: "timeline_2mo", status: "todo", priority: "high" },
    { title: "Follow up on RSVPs", description: "Track responses, contact non-responders", category: "timeline_2mo", status: "todo", priority: "high" },
    { title: "Finalize guest numbers", description: "Final headcount for caterer + venue", category: "timeline_2mo", status: "todo", priority: "high" },
    { title: "Confirm accommodation arrangements", description: "Hotel bookings for out-of-town guests", category: "timeline_2mo", status: "todo", priority: "medium" },
    { title: "Confirm honeymoon bookings", description: "Flights + hotels for honeymoon", category: "timeline_2mo", status: "todo", priority: "medium" },
    { title: "Confirm vendor contracts and payments", description: "Review all contracts, pay deposits", category: "timeline_2mo", status: "todo", priority: "high" },
    { title: "Purchase gifts for bridal party and parents", description: "Thank-you gifts for attendants + parents", category: "timeline_2mo", status: "todo", priority: "medium" },
    // 1 month before
    { title: "Final dress fitting", description: "Last fitting before wedding day", category: "timeline_1mo", status: "todo", priority: "high" },
    { title: "Hair and makeup trial", description: "Trial run with MUA", category: "timeline_1mo", status: "todo", priority: "medium" },
    { title: "Confirm ceremony program", description: "Final order of service", category: "timeline_1mo", status: "todo", priority: "high" },
    { title: "Confirm seating arrangements", description: "Finalize table assignments", category: "timeline_1mo", status: "todo", priority: "medium" },
    { title: "Confirm timeline with vendors", description: "Share day-of schedule with all vendors", category: "timeline_1mo", status: "todo", priority: "high" },
    { title: "Prepare emergency bridal kit", description: "Safety pins, tissues, makeup touch-ups", category: "timeline_1mo", status: "todo", priority: "low" },
    { title: "Prepare speeches and toasts", description: "Best man, MOH, parents speeches", category: "timeline_1mo", status: "todo", priority: "medium" },
    { title: "Obtain marriage license and legal documents", description: "Civil registration at Magistrates Court", category: "timeline_1mo", status: "todo", priority: "high" },
    // 2 weeks before
    { title: "Confirm final guest count", description: "Give final numbers to caterer + venue", category: "timeline_2wk", status: "todo", priority: "high" },
    { title: "Make final vendor payments", description: "Settle all outstanding balances", category: "timeline_2wk", status: "todo", priority: "high" },
    { title: "Confirm transportation schedule", description: "Shuttle times + bridal car pickup", category: "timeline_2wk", status: "todo", priority: "medium" },
    { title: "Pack honeymoon luggage", description: "Begin packing for honeymoon", category: "timeline_2wk", status: "todo", priority: "low" },
    { title: "Confirm bridal party responsibilities", description: "Brief bridesmaids + groomsmen on roles", category: "timeline_2wk", status: "todo", priority: "medium" },
    { title: "Confirm music playlist", description: "Send final song list to DJ", category: "timeline_2wk", status: "todo", priority: "medium" },
    { title: "Prepare welcome bags for guests", description: "Gift bags for out-of-town guests", category: "timeline_2wk", status: "todo", priority: "low" },
    // 1 week before
    { title: "Confirm all vendor arrival times", description: "Final check with every vendor", category: "timeline_1wk", status: "todo", priority: "high" },
    { title: "Pick up wedding dress", description: "Collect dress from boutique/tailor", category: "timeline_1wk", status: "todo", priority: "high" },
    { title: "Prepare wedding-day essentials", description: "Pack emergency kit + overnight bag", category: "timeline_1wk", status: "todo", priority: "medium" },
    { title: "Delegate tasks to trusted family/friends", description: "Assign day-of coordination roles", category: "timeline_1wk", status: "todo", priority: "medium" },
    { title: "Get manicure and pedicure", description: "Nail appointment for bride", category: "timeline_1wk", status: "todo", priority: "low" },
    { title: "Have rehearsal and rehearsal dinner", description: "Practice ceremony + dinner with party", category: "timeline_1wk", status: "todo", priority: "high" },
    { title: "Pray and prepare emotionally for marriage", description: "Quiet time, prayer, emotional preparation", category: "timeline_1wk", status: "todo", priority: "high" },
    // Wedding day — bride essentials
    { title: "Wedding dress", description: "The gown", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Veil", description: "Bridal veil", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Shoes", description: "Wedding shoes + comfortable reception shoes", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Jewelry", description: "Bridal jewelry", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "Perfume", description: "Signature scent", category: "wedding_day", status: "todo", priority: "low" },
    { title: "Marriage license/documents", description: "Legal documents for ceremony", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Phone charger", description: "Phone + charger for the day", category: "wedding_day", status: "todo", priority: "low" },
    { title: "Touch-up makeup kit", description: "Lipstick, powder for touch-ups", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "Tissues", description: "For happy tears", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "Safety pins", description: "Emergency wardrobe fixes", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "Comfortable shoes for reception", description: "Flats for dancing", category: "wedding_day", status: "todo", priority: "medium" },
    // Wedding day — before ceremony
    { title: "Eat breakfast and stay hydrated", description: "Important — eat before the rush", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Hair appointment", description: "Bridal hair styling", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Makeup appointment", description: "Bridal makeup application", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Bridal party photos", description: "Photos with bridesmaids before ceremony", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "Family photos", description: "Pre-ceremony family photos", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "Quiet time for prayer and reflection", description: "Moment of peace before the ceremony", category: "wedding_day", status: "todo", priority: "high" },
    // Wedding day — during ceremony
    { title: "Rings ready", description: "Wedding rings at the altar", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Vows ready", description: "Personalized vows written + ready", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Bouquet ready", description: "Bridal bouquet prepared", category: "wedding_day", status: "todo", priority: "high" },
    { title: "Marriage register ready", description: "Sign the official marriage register", category: "wedding_day", status: "todo", priority: "high" },
    // Wedding day — reception
    { title: "Grand entrance", description: "Couple enters reception", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "Cake cutting", description: "Cut the wedding cake together", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "First dance", description: "First dance as married couple", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "Family photos at reception", description: "Reception family photos", category: "wedding_day", status: "todo", priority: "medium" },
    { title: "Bouquet toss (optional)", description: "Toss bouquet to single ladies", category: "wedding_day", status: "todo", priority: "low" },
    { title: "Thank guests", description: "Personally thank guests for coming", category: "wedding_day", status: "todo", priority: "high" },
    // Spiritual
    { title: "Commit the marriage to God in prayer", description: "Dedicate the union to God", category: "spiritual", status: "todo", priority: "high" },
    { title: "Complete premarital counseling", description: "Finish all counseling sessions", category: "spiritual", status: "todo", priority: "high" },
    { title: "Pray together as a couple regularly", description: "Establish prayer routine together", category: "spiritual", status: "todo", priority: "high" },
    { title: "Discuss family vision and goals", description: "Align on family direction", category: "spiritual", status: "todo", priority: "medium" },
    { title: "Discuss finances and budgeting", description: "Align on financial management", category: "spiritual", status: "todo", priority: "medium" },
    { title: "Discuss children and parenting expectations", description: "Align on family planning", category: "spiritual", status: "todo", priority: "medium" },
    { title: "Discuss church involvement", description: "Align on church community", category: "spiritual", status: "todo", priority: "medium" },
    { title: "Write a marriage covenant before God", description: "Create a written covenant", category: "spiritual", status: "todo", priority: "high" },
    { title: "Choose a marriage scripture", description: "Select a verse for the marriage", category: "spiritual", status: "todo", priority: "medium" },
  ];

  return raw.map((t, i) => ({ ...t, assignee: alt(i) }));
}

/**
 * Default budget items for a new couple — 14 line items across
 * the standard wedding-budget categories. Estimated costs are
 * conservative USD figures; the couple adjusts after onboarding.
 */
export function buildDefaultBudgetItems(): DefaultBudgetItem[] {
  return [
    { category: "venue", description: "Venue — full-day hire + ceremony space", estimatedCost: 4500, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "catering", description: "Caterer — full dinner + canapés", estimatedCost: 6000, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "catering", description: "Wedding cake — three-tier (fruit + sponge)", estimatedCost: 600, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "attire", description: "Bride's gown + alterations", estimatedCost: 1800, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "attire", description: "Groom's suit + shirt + shoes", estimatedCost: 800, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "attire", description: "Bridal party attire", estimatedCost: 2400, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "decor", description: "Florist — bouquets, centerpieces, ceremony arch", estimatedCost: 2500, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "decor", description: "Lighting + drapery + chair covers", estimatedCost: 1200, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "photo_video", description: "Photographer + videographer (full day + reel)", estimatedCost: 3200, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "music", description: "DJ + MC + sound system", estimatedCost: 1500, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "transport", description: "Shuttle for guests + bridal car", estimatedCost: 900, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "stationery", description: "Invitations, programmes, place cards", estimatedCost: 700, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "miscellaneous", description: "Marriage license + tips + contingency", estimatedCost: 1500, actualCost: null, paidAmount: 0, currency: "USD" },
    { category: "miscellaneous", description: "Honeymoon (flights + accommodation)", estimatedCost: 4000, actualCost: null, paidAmount: 0, currency: "USD" },
  ];
}

/**
 * Default day-of timeline — 11 blocks matching a standard
 * wedding-day flow. The couple adjusts times/locations after
 * onboarding.
 */
export function buildDefaultTimeline(venue: string): DefaultTimelineBlock[] {
  return [
    { time: "13:00", event: "Guests Arrive", duration: "60 min", location: `${venue} gardens`, notes: "Welcome drinks & canapés. Ushers escort guests to seats." },
    { time: "14:00", event: "Ceremony Begins", duration: "45 min", location: "Ceremony garden", notes: "Processional, vows, ring exchange, kiss." },
    { time: "14:45", event: '"I Do" — The Vows', duration: "15 min", location: "Ceremony garden", notes: "The moment we say forever." },
    { time: "15:00", event: "Confetti & Celebrations", duration: "30 min", location: "Venue steps", notes: "Rice toss + family photos on the steps." },
    { time: "15:30", event: "Cocktail Hour & Canapés", duration: "60 min", location: "Garden terrace", notes: "Signature cocktails, lawn games, live jazz." },
    { time: "16:30", event: "Reception & First Dance", duration: "30 min", location: "Reception hall", notes: "The couple takes the floor." },
    { time: "17:00", event: "Dinner is Served", duration: "90 min", location: "Reception hall", notes: "A feast to remember." },
    { time: "18:30", event: "Speeches & Toasts", duration: "60 min", location: "Reception hall", notes: "Best man, MOH, parents." },
    { time: "19:30", event: "Cutting the Cake", duration: "20 min", location: "Reception hall", notes: "Sweet beginnings." },
    { time: "20:00", event: "Dance Floor Opens", duration: "120 min", location: "Reception hall", notes: "Let the celebration begin!" },
    { time: "22:00", event: "Last Dance & Sparkler Exit", duration: "30 min", location: "Driveway", notes: "A magical farewell." },
  ];
}

/**
 * Default 8-table seating plan — a sensible starter layout
 * the couple can rename / resize after onboarding.
 */
export function buildDefaultSeatingTables(): DefaultSeatingTable[] {
  return [
    { name: "Table 1 — Family", capacity: 8 },
    { name: "Table 2 — Family", capacity: 8 },
    { name: "Table 3 — Bridal Party", capacity: 8 },
    { name: "Table 4 — Bridal Party", capacity: 8 },
    { name: "Table 5 — Friends", capacity: 8 },
    { name: "Table 6 — Friends", capacity: 8 },
    { name: "Table 7 — Colleagues", capacity: 8 },
    { name: "Table 8 — VIPs", capacity: 8 },
  ];
}
