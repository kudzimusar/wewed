import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug')?.trim() || 'charity-and-kudzie'
    const wedding = await db.wedding.findFirst({
      where: { slug },
      include: {
        couple: { include: { kids: true } },
        programmeItems: { orderBy: { order: 'asc' } },
        songs: { orderBy: [{ order: 'asc' }, { votes: 'desc' }] },
        guests: {
          where: { role: { in: ['bridal_party', 'family'] } },
          orderBy: [{ side: 'asc' }, { roleDetail: 'asc' }],
        },
        vendors: { orderBy: { featured: 'desc' } },
        messages: {
          where: { isPublic: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!wedding) {
      return NextResponse.json(
        { success: false, error: `Wedding not found for slug "${slug}".` },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
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
        theme: {
          primaryColor: wedding.primaryColor,
          accentColor: wedding.accentColor,
          memoryColor: wedding.memoryColor,
          backgroundColor: wedding.backgroundColor,
        },
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
        programme: wedding.programmeItems.map((item) => ({
          id: item.id,
          time: item.time,
          title: item.title,
          description: item.description,
          icon: item.icon,
          order: item.order,
        })),
        songs: wedding.songs.map((song) => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          phase: song.phase,
          moment: song.moment,
          votes: song.votes,
          order: song.order,
        })),
        bridalParty: wedding.guests.map((guest) => ({
          id: guest.id,
          name: guest.name,
          role: guest.role,
          roleDetail: guest.roleDetail,
          side: guest.side,
        })),
        vendors: wedding.vendors.map((vendor) => ({
          id: vendor.id,
          name: vendor.name,
          category: vendor.category,
          description: vendor.description,
          website: vendor.website,
          featured: vendor.featured,
        })),
        messages: wedding.messages.map((message) => ({
          id: message.id,
          type: message.type,
          content: message.content,
          authorName: message.authorName,
          createdAt: message.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error('[WEDDING GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wedding data.' },
      { status: 500 },
    )
  }
}

export const dynamic = 'force-dynamic'
