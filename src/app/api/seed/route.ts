import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// ─── Song Data ────────────────────────────────────────────────────────────────

const SONGS = [
  // Ceremony
  { title: "Ave Maria", artist: "Franz Schubert", phase: "ceremony", moment: "Processional", order: 1 },
  { title: "Here Comes The Sun", artist: "The Beatles", phase: "bridal_entrance", moment: "Bridal Entrance", order: 2 },
  { title: "All You Need Is Love", artist: "The Beatles", phase: "recessional", moment: "Recessional", order: 3 },

  // Reception
  { title: "September", artist: "Earth, Wind & Fire", phase: "reception", moment: null, order: 4 },
  { title: "Lovely Day", artist: "Bill Withers", phase: "reception", moment: null, order: 5 },
  { title: "Isn't She Lovely", artist: "Stevie Wonder", phase: "reception", moment: null, order: 6 },
  { title: "We Are Family", artist: "Sister Sledge", phase: "reception", moment: null, order: 7 },
  { title: "Dancing in the Moonlight", artist: "King Harvest", phase: "reception", moment: null, order: 8 },
  { title: "Svikiro", artist: "Mokoomba", phase: "reception", moment: null, order: 9 },
  { title: "Neria", artist: "Oliver Mtukudzi", phase: "reception", moment: null, order: 10 },
  { title: "Chikwata", artist: "Alick Macheso", phase: "reception", moment: null, order: 11 },
  { title: "Sweet Caroline", artist: "Neil Diamond", phase: "reception", moment: null, order: 12 },
  { title: "I Wanna Dance with Somebody", artist: "Whitney Houston", phase: "reception", moment: null, order: 13 },
  { title: "Hey Jude", artist: "The Beatles", phase: "reception", moment: null, order: 14 },
  { title: "Don't Stop Me Now", artist: "Queen", phase: "reception", moment: null, order: 15 },
  { title: "Stand By Me", artist: "Ben E. King", phase: "reception", moment: null, order: 16 },
  { title: "Put Your Records On", artist: "Corinne Bailey Rae", phase: "reception", moment: null, order: 17 },
  { title: "You're My Best Friend", artist: "Queen", phase: "reception", moment: null, order: 18 },
  { title: "Saturday Night", artist: "Whigfield", phase: "reception", moment: null, order: 19 },
  { title: "Masquerade", artist: "Alick Macheso", phase: "reception", moment: null, order: 20 },
  { title: "Chitekete", artist: "Oliver Mtukudzi", phase: "reception", moment: null, order: 21 },
  { title: "Malaika", artist: "Miriam Makeba", phase: "reception", moment: null, order: 22 },

  // First Dance
  { title: "At Last", artist: "Etta James", phase: "first_dance", moment: "First Dance", order: 23 },
  { title: "Perfect", artist: "Ed Sheeran", phase: "first_dance", moment: "First Dance", order: 24 },
  { title: "Thinking Out Loud", artist: "Ed Sheeran", phase: "first_dance", moment: "First Dance", order: 25 },
  { title: "A Thousand Years", artist: "Christina Perri", phase: "first_dance", moment: "First Dance", order: 26 },
];

// ─── Programme Items ──────────────────────────────────────────────────────────

const PROGRAMME_ITEMS = [
  { time: "13:00", title: "Guest Arrival", description: "Welcome drinks and canapés at Imba Manor gardens", icon: "GlassWater", order: 1 },
  { time: "14:00", title: "Ceremony Begins", description: "The wedding ceremony under the African sky", icon: "Heart", order: 2 },
  { time: "14:45", title: "Confetti & Congratulations", description: "Rice toss and family photos on the Manor steps", icon: "PartyPopper", order: 3 },
  { time: "15:30", title: "Cocktail Hour", description: "Signature cocktails, lawn games and live jazz", icon: "Wine", order: 4 },
  { time: "16:30", title: "Reception Entrance", description: "Mr & Mrs Musarurwa make their grand entrance", icon: "Sparkles", order: 5 },
  { time: "17:00", title: "First Dance", description: "Charity & Kudzie take the floor for the first time as one", icon: "Music", order: 6 },
  { time: "17:30", title: "Dinner is Served", description: "A feast celebrating Zimbabwean flavours and global cuisine", icon: "UtensilsCrossed", order: 7 },
  { time: "18:30", title: "Speeches & Toasts", description: "Words from the best man, maid of honour, and family", icon: "Mic", order: 8 },
  { time: "19:30", title: "Cake Cutting", description: "The couple cuts the cake — a sweet new beginning", icon: "Cake", order: 9 },
  { time: "20:00", title: "Dance Floor Opens", description: "DJ spins the night away — from Sungura to pop anthems", icon: "Disc3", order: 10 },
  { time: "22:00", title: "Last Dance", description: "One final dance under the stars before the night ends", icon: "Moon", order: 11 },
  { time: "22:30", title: "Sparkler Send-Off", description: "Guests light the way as Charity & Kudzie depart", icon: "Flame", order: 12 },
];

// ─── Sample Bridal Party ─────────────────────────────────────────────────────

const BRIDAL_PARTY = [
  { name: "Chiedza M.", role: "bridal_party", roleDetail: "Maid of Honour", side: "bride" },
  { name: "Rumbidzai C.", role: "bridal_party", roleDetail: "Bridesmaid", side: "bride" },
  { name: "Nyasha T.", role: "bridal_party", roleDetail: "Bridesmaid", side: "bride" },
  { name: "Tafadzwa K.", role: "bridal_party", roleDetail: "Best Man", side: "groom" },
  { name: "Tendai M.", role: "bridal_party", roleDetail: "Groomsman", side: "groom" },
  { name: "Munyaradzi S.", role: "bridal_party", roleDetail: "Groomsman", side: "groom" },
  { name: "Mrs. Musarurwa Sr.", role: "family", roleDetail: "Mother of the Groom", side: "groom" },
  { name: "Mr. Musarurwa Sr.", role: "family", roleDetail: "Father of the Groom", side: "groom" },
];

// ─── POST /api/seed ──────────────────────────────────────────────────────────
// Seed the database with the flagship wedding data.
// Uses upsert/check to avoid duplicates on repeated calls.

export async function POST() {
  try {
    const counts: Record<string, number> = {};

    // 1. Upsert Couple
    const couple = await db.couple.upsert({
      where: { slug: "charity-and-kudzie" },
      update: {},
      create: {
        slug: "charity-and-kudzie",
        partner1: "Charity",
        partner2: "Kudzie",
        surname: "Musarurwa",
      },
    });
    counts.couples = 1;

    // 2. Upsert Kids
    const existingKids = await db.kid.count({
      where: { coupleId: couple.id },
    });

    if (existingKids === 0) {
      await db.kid.createMany({
        data: [
          { name: "Norioshona", gender: "boy", coupleId: couple.id },
          { name: "Narasora", gender: "girl", coupleId: couple.id },
        ],
      });
    }
    counts.kids = await db.kid.count({ where: { coupleId: couple.id } });

    // 3. Upsert Wedding
    const wedding = await db.wedding.upsert({
      where: { slug: "charity-and-kudzie" },
      update: {},
      create: {
        slug: "charity-and-kudzie",
        title: "Charity & Kudzie",
        monogram: "C&K",
        tagline: "23.12.26",
        date: new Date("2026-12-23T14:00:00Z"),
        venue: "Imba Manor",
        venueCity: "Harare",
        venueCountry: "Zimbabwe",
        primaryColor: "#BF9B5F",
        accentColor: "#C0633F",
        memoryColor: "#6B2D3A",
        backgroundColor: "#FBF6EE",
        lifecycle: "before",
        coupleId: couple.id,
      },
    });
    counts.weddings = 1;

    // 4. Seed Songs (check count first)
    const existingSongs = await db.song.count({
      where: { weddingId: wedding.id },
    });

    if (existingSongs === 0) {
      await db.song.createMany({
        data: SONGS.map((s) => ({
          ...s,
          votes: 0,
          weddingId: wedding.id,
        })),
      });
    }
    counts.songs = await db.song.count({ where: { weddingId: wedding.id } });

    // 5. Seed Programme Items
    const existingProgramme = await db.programmeItem.count({
      where: { weddingId: wedding.id },
    });

    if (existingProgramme === 0) {
      await db.programmeItem.createMany({
        data: PROGRAMME_ITEMS.map((p) => ({
          ...p,
          weddingId: wedding.id,
        })),
      });
    }
    counts.programmeItems = await db.programmeItem.count({
      where: { weddingId: wedding.id },
    });

    // 6. Seed Bridal Party / Family as Guests
    const existingBridalParty = await db.guest.count({
      where: { weddingId: wedding.id },
    });

    if (existingBridalParty === 0) {
      await db.guest.createMany({
        data: BRIDAL_PARTY.map((bp) => ({
          name: bp.name,
          role: bp.role,
          roleDetail: bp.roleDetail,
          side: bp.side,
          weddingId: wedding.id,
        })),
      });
    }
    counts.guests = await db.guest.count({ where: { weddingId: wedding.id } });

    // 7. Seed Sample Vendor: Imba Manor
    const existingVendors = await db.vendor.count({
      where: { weddingId: wedding.id },
    });

    if (existingVendors === 0) {
      await db.vendor.create({
        data: {
          name: "Imba Manor",
          category: "venue",
          description:
            "An exclusive boutique venue nestled in the rolling hills of Harare, offering old-world elegance with modern luxury. The perfect setting for Charity & Kudzie's forever beginning.",
          website: "https://imbamanor.co.zw",
          featured: true,
          weddingId: wedding.id,
        },
      });
    }
    counts.vendors = await db.vendor.count({ where: { weddingId: wedding.id } });

    // 8. Seed Sample Messages
    const existingMessages = await db.message.count({
      where: { weddingId: wedding.id },
    });

    if (existingMessages === 0) {
      await db.message.createMany({
        data: [
          {
            type: "wall",
            content: "Wishing you a lifetime of love and happiness! 🤍",
            authorName: "Tendai M.",
            isPublic: true,
            weddingId: wedding.id,
          },
          {
            type: "wall",
            content:
              "Charity & Kudzie, you two are proof that true love exists. Makorokoto!",
            authorName: "Rumbidzai C.",
            isPublic: true,
            weddingId: wedding.id,
          },
          {
            type: "wall",
            content:
              "From the first day I met you both, I knew this was forever. So happy for you!",
            authorName: "Takudzwa M.",
            isPublic: true,
            weddingId: wedding.id,
          },
        ],
      });
    }
    counts.messages = await db.message.count({
      where: { weddingId: wedding.id },
    });

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully",
      counts,
    });
  } catch (error) {
    console.error("[SEED POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to seed database", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
