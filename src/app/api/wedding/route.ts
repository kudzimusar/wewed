import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// ─── GET /api/wedding ────────────────────────────────────────────────────────
// Return the flagship wedding data (all public info)
// Includes: wedding details, programme, songs, bridal party, vendors

export async function GET() {
  try {
    const wedding = await db.wedding.findFirst({
      where: { slug: "charity-and-kudzie" },
      include: {
        couple: {
          include: {
            kids: true,
          },
        },
        programmeItems: {
          orderBy: { order: "asc" },
        },
        songs: {
          orderBy: [{ order: "asc" }, { votes: "desc" }],
        },
        guests: {
          where: {
            role: { in: ["bridal_party", "family"] },
          },
          orderBy: [{ side: "asc" }, { roleDetail: "asc" }],
        },
        vendors: {
          orderBy: { featured: "desc" },
        },
        messages: {
          where: { isPublic: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!wedding) {
      return NextResponse.json(
        { error: "Wedding not found. Please seed the database first." },
        { status: 404 }
      );
    }

    // Shape the response for public consumption
    const publicData = {
      // Wedding basics
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

      // Theme
      theme: {
        primaryColor: wedding.primaryColor,
        accentColor: wedding.accentColor,
        memoryColor: wedding.memoryColor,
        backgroundColor: wedding.backgroundColor,
      },

      // Couple & Family
      couple: {
        partner1: wedding.couple.partner1,
        partner2: wedding.couple.partner2,
        surname: wedding.couple.surname,
        photo: wedding.couple.photo,
        kids: wedding.couple.kids.map((kid) => ({
          name: kid.name,
          gender: kid.gender,
        })),
      },

      // Programme (timeline)
      programme: wedding.programmeItems.map((item) => ({
        id: item.id,
        time: item.time,
        title: item.title,
        description: item.description,
        icon: item.icon,
        order: item.order,
      })),

      // Songs
      songs: wedding.songs.map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        phase: song.phase,
        moment: song.moment,
        votes: song.votes,
        order: song.order,
      })),

      // Bridal Party & Family
      bridalParty: wedding.guests.map((guest) => ({
        id: guest.id,
        name: guest.name,
        role: guest.role,
        roleDetail: guest.roleDetail,
        side: guest.side,
      })),

      // Vendors
      vendors: wedding.vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        description: vendor.description,
        website: vendor.website,
        featured: vendor.featured,
      })),

      // Guest wall messages
      messages: wedding.messages.map((msg) => ({
        id: msg.id,
        type: msg.type,
        content: msg.content,
        authorName: msg.authorName,
        createdAt: msg.createdAt,
      })),
    };

    return NextResponse.json({
      success: true,
      data: publicData,
    });
  } catch (error) {
    console.error("[WEDDING GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch wedding data" },
      { status: 500 }
    );
  }
}
